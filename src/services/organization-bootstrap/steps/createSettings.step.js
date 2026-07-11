import Setting from '#modules/setting/setting.model.js';
import { BootstrapStep } from './bootstrapStep.js';
import { buildDefaultSettings } from '../factories/defaultSettings.factory.js';

export class CreateSettingsStep extends BootstrapStep {
  constructor() {
    super('createSettings');
  }

  async execute(context, session) {
    const settingsData = buildDefaultSettings(context.organization._id);

    const [setting] = await Setting.create([settingsData], { session });

    context.setting = setting;
  }
}
