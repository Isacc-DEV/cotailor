import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { CurrentUser } from './current-user.decorator';
import type { AuthUser } from './auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('signup')
  async signup(@Body() body: { email: string; password: string; name?: string }) {
    return this.authService.signup(body);
  }

  @Public()
  @Post('signin')
  @HttpCode(200)
  async signin(@Body() body: { email: string; password: string }) {
    return this.authService.signin(body);
  }

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.userId);
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      name?: string;
      theme?: 'light' | 'dark' | 'system';
      aiProviderMode?: 'cotailor' | 'own_keys';
      certSuggestionCount?: number;
    },
  ) {
    return this.authService.updateSettings(user.userId, body);
  }

  @Post('change-password')
  @HttpCode(200)
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.authService.changePassword(user.userId, body.currentPassword, body.newPassword);
  }

  @Post('deactivate')
  @HttpCode(200)
  async deactivate(@CurrentUser() user: AuthUser) {
    return this.authService.deactivate(user.userId);
  }
}
