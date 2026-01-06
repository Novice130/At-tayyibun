import { Controller, Get, Put, Body, Param, Query, Req } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { Request } from "express";
import { ProfilesService, BrowseFilters } from "./profiles.service";
import { UpdateProfileDto } from "./dto";
import { CurrentUser, Public } from "../../common/decorators";
import { Throttle } from "@nestjs/throttler";
import { Gender } from "@prisma/client";

@ApiTags("Profiles")
@Controller("profiles")
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get()
  @Throttle({ medium: { limit: 60, ttl: 60000 } }) // 60 per minute
  @ApiBearerAuth()
  @ApiOperation({ summary: "Browse profiles with filters" })
  @ApiQuery({ name: "ethnicity", required: false })
  @ApiQuery({ name: "gender", required: false, enum: ["MALE", "FEMALE"] })
  @ApiQuery({ name: "minAge", required: false, type: Number })
  @ApiQuery({ name: "maxAge", required: false, type: Number })
  @ApiQuery({
    name: "sortBy",
    required: false,
    enum: ["age", "createdAt", "rankBoost"],
  })
  @ApiQuery({ name: "order", required: false, enum: ["asc", "desc"] })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Paginated list of profiles" })
  async browseProfiles(
    @Query("ethnicity") ethnicity?: string,
    @Query("gender") gender?: Gender,
    @Query("minAge") minAge?: number,
    @Query("maxAge") maxAge?: number,
    @Query("sortBy") sortBy?: "age" | "createdAt" | "rankBoost",
    @Query("order") order?: "asc" | "desc",
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @CurrentUser("id") userId?: string
  ) {
    const filters: BrowseFilters = {
      ethnicity,
      gender,
      minAge,
      maxAge,
      sortBy,
      order,
      page: page || 1,
      limit: Math.min(limit || 20, 50), // Max 50 per page
    };

    return this.profilesService.browseProfiles(filters, userId);
  }

  @Public()
  @Get(":publicId")
  @ApiOperation({ summary: "Get a profile by public ID" })
  @ApiResponse({ status: 200, description: "Profile details" })
  @ApiResponse({ status: 404, description: "Profile not found" })
  async getProfile(@Param("publicId") publicId: string, @Req() req: Request) {
    const isAuthenticated = !!req.user;
    return this.profilesService.getProfileByPublicId(publicId, isAuthenticated);
  }

  @Get("me")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user's profile" })
  @ApiResponse({
    status: 200,
    description: "Full profile with decrypted fields",
  })
  async getMyProfile(@CurrentUser("id") userId: string) {
    return this.profilesService.getMyProfile(userId);
  }

  @Put("me")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update current user's profile" })
  @ApiResponse({ status: 200, description: "Updated profile" })
  async updateMyProfile(
    @Body() dto: UpdateProfileDto,
    @CurrentUser("id") userId: string
  ) {
    // Convert dob to Date if it's a string
    const data = { ...dto, dob: dto.dob ? new Date(dto.dob) : undefined };
    return this.profilesService.updateMyProfile(userId, data);
  }
}
