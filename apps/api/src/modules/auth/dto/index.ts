import { IsEmail, IsString, MinLength, MaxLength, Matches, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignupDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecureP@ss123' })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Password must contain uppercase, lowercase, number, and special character',
  })
  password: string;

  @ApiProperty({ example: '+15551234567' })
  @IsString()
  @Matches(/^\+1[0-9]{10}$/, {
    message: 'Phone must be a valid US number in format +1XXXXXXXXXX',
  })
  phone: string;

  @ApiProperty({ example: 'Ahmad' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName: string;

  @ApiProperty({ example: 'MALE', enum: ['MALE', 'FEMALE'] })
  @IsIn(['MALE', 'FEMALE'])
  gender: string;
}

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecureP@ss123' })
  @IsString()
  password: string;
}

export class VerifyPhoneDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code: string;
}

// Two-Factor Authentication DTOs
export * from './two-factor.dto';
