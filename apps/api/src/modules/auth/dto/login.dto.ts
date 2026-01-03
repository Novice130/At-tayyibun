import { IsEmail, IsString, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}

export class OAuthDto {
  @IsString()
  @IsNotEmpty({ message: 'Firebase ID token is required' })
  idToken: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty({ message: 'Refresh token is required' })
  refreshToken: string;
}

export class VerifyPhoneDto {
  @IsString()
  @IsNotEmpty({ message: 'Verification code is required' })
  verificationCode: string;

  @IsString()
  @IsNotEmpty({ message: 'Verification ID is required' })
  verificationId: string;
}
