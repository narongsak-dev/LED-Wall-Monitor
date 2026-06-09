import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '@/common/decorators/current-user.decorator';
import { SitesService } from './sites.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';

@ApiTags('sites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sites')
export class SitesController {
  constructor(private readonly sites: SitesService) {}

  // Any authenticated user — returns only the sites they have UserSite for.
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.sites.listForUser(user.id);
  }

  // Used by the user-management form's site picker: super_admin sees every
  // site; site_admin sees only the sites they're attached to (so they can
  // only grant access within their own scope).
  @Get('all')
  @Roles('super_admin', 'site_admin')
  async listAll(@CurrentUser() user: AuthUser) {
    if (user.role === 'super_admin') return this.sites.listAll();
    const rows = await this.sites.listForUser(user.id);
    return rows.map((r) => r.site);
  }

  // Any authenticated user can fetch a site by id (the UI only shows links to
  // sites they actually have access to). A future enhancement could enforce
  // membership at the service layer.
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.sites.findOne(BigInt(id));
  }

  // Create / delete remain platform-level operations.
  @Post()
  @Roles('super_admin')
  create(@Body() dto: CreateSiteDto) {
    return this.sites.create(dto);
  }

  // site_admin can update sites they manage (rename, change location). The
  // SiteManagerRoute in the frontend prevents viewers from reaching this
  // endpoint, and only super-admins see the list of all sites.
  @Patch(':id')
  @Roles('super_admin', 'site_admin')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSiteDto) {
    return this.sites.update(BigInt(id), dto);
  }

  @Delete(':id')
  @Roles('super_admin')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.sites.remove(BigInt(id));
  }
}
