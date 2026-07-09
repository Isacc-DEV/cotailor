import { Module } from '@nestjs/common';
import { TaxonomyController } from './taxonomy.controller';
import { AdminTaxonomyController } from './admin-taxonomy.controller';
import { TaxonomyService } from './taxonomy.service';
import { AdminGuard } from '../admin/admin.guard';

@Module({
  controllers: [TaxonomyController, AdminTaxonomyController],
  providers: [TaxonomyService, AdminGuard],
  exports: [TaxonomyService],
})
export class TaxonomyModule {}
