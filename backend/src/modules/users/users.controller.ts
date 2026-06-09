import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { AdminGuard } from '@/common/guards/admin.guard';
import { CurrentUser, AuthUser } from '@/common/decorators/current-user.decorator';
import { PrismaService } from '@/prisma/prisma.service';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginHistoryQueryDto } from './dto/login-history-query.dto';
import type { User } from '@prisma/client';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  /** Re-load the actor's User row from DB so we have an up-to-date role
   *  (a JWT claim could be stale if their role changed mid-session) and so
   *  the scoped methods get a real Prisma User to work with. */
  private async loadActor(current: AuthUser): Promise<User> {
    const actor = await this.prisma.user.findUnique({
      where: { id: BigInt(current.id) },
    });
    if (!actor || !actor.isActive) {
      throw new ForbiddenException('บัญชีของคุณถูกระงับ');
    }
    return actor;
  }

  @Get('me')
  async me(@CurrentUser() current: AuthUser) {
    const user = await this.users.findById(BigInt(current.id));
    if (!user) throw new NotFoundException('User not found');
    return this.users.toPublic(user);
  }

  @Patch('me')
  updateProfile(@CurrentUser() current: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(BigInt(current.id), dto);
  }

  @Post('me/change-password')
  @HttpCode(200)
  changePassword(@CurrentUser() current: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.users.changePassword(BigInt(current.id), dto.currentPassword, dto.newPassword);
  }

  /** Current user's own login history. */
  @Get('me/login-history')
  myLoginHistory(@CurrentUser() current: AuthUser, @Query() query: LoginHistoryQueryDto) {
    return this.users.listLoginHistory(BigInt(current.id), query.limit ?? 20, query.offset ?? 0);
  }

  /** All users' login history — super_admin only. */
  @Get('login-history/all')
  @UseGuards(AdminGuard)
  allLoginHistory(@Query() query: LoginHistoryQueryDto) {
    return this.users.listLoginHistory(null, query.limit ?? 20, query.offset ?? 0);
  }

  /** List users visible to the actor. super_admin sees everything; site_admin
   *  sees users with site overlap; viewer is blocked by RolesGuard upstream. */
  @Get()
  async listAll(@CurrentUser() current: AuthUser) {
    const actor = await this.loadActor(current);
    if (actor.role === 'viewer') throw new ForbiddenException('สิทธิ์ไม่เพียงพอ');
    return this.users.listScoped(actor);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() current: AuthUser,
  ) {
    const actor = await this.loadActor(current);
    const target = await this.prisma.user.findUnique({ where: { id: BigInt(id) } });
    if (!target) throw new NotFoundException('User not found');
    await this.users.assertCanManage(actor, target);
    return this.users.findWithPermissions(BigInt(id));
  }

  @Post()
  async create(@Body() dto: CreateUserDto, @CurrentUser() current: AuthUser) {
    const actor = await this.loadActor(current);
    return this.users.create(dto, actor);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() current: AuthUser,
  ) {
    const actor = await this.loadActor(current);
    return this.users.update(BigInt(id), dto, actor);
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() current: AuthUser,
  ) {
    const actor = await this.loadActor(current);
    return this.users.remove(BigInt(id), actor);
  }

  /** Admin reset: generates a random temporary password and returns it once.
   *  super_admin can reset any user (including other super_admins → cross-
   *  reset); site_admin can reset viewers in their site overlap. */
  @Post(':id/reset-password')
  @HttpCode(200)
  async resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() current: AuthUser,
  ) {
    const actor = await this.loadActor(current);
    return this.users.adminResetPassword(BigInt(id), actor);
  }
}
