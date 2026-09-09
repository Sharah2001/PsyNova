import { PlatformSettings } from '../../lib/types';
import { initialPlatformSettings } from '../../lib/mockData';
import { DatabaseService } from '../database/database.service';

export class SettingsService {
  private settings: PlatformSettings = { ...initialPlatformSettings };

  constructor(private readonly databaseService?: DatabaseService) {}

  getSettings(): PlatformSettings {
    return this.settings;
  }

  updateSettings(data: Partial<PlatformSettings>): PlatformSettings {
    this.settings = { ...this.settings, ...data };
    this.databaseService?.saveSettings(this.settings).catch((e) => console.warn('Postgres saveSettings error:', e));
    return this.settings;
  }
}
