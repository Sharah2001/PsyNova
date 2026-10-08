import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getDatabaseOptions } from './database.config';
import { PsychiatristEntity } from './entities/psychiatrist.entity';
import { BookingEntity } from './entities/booking.entity';
import { PatientEntity } from './entities/patient.entity';
import { ReviewEntity } from './entities/review.entity';
import { ComplaintEntity } from './entities/complaint.entity';
import { SettingsEntity } from './entities/settings.entity';
import { BlogEntity } from './entities/blog.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const dbOptions = getDatabaseOptions(process.env);

        return {
          ...dbOptions,
          entities: [
            PsychiatristEntity,
            BookingEntity,
            PatientEntity,
            ReviewEntity,
            ComplaintEntity,
            SettingsEntity,
            BlogEntity,
          ],
          migrationsRun: false,
          autoLoadEntities: true,
        };
      },
    }),
    TypeOrmModule.forFeature([
      PsychiatristEntity,
      BookingEntity,
      PatientEntity,
      ReviewEntity,
      ComplaintEntity,
      SettingsEntity,
      BlogEntity,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
