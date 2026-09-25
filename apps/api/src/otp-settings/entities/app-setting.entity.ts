import { Column, Entity, PrimaryColumn } from 'typeorm';

// A tiny generic key-value store — the "mobile OTP enabled" switch is
// the first thing in it, but any future on/off toggle can reuse this
// same table instead of getting its own migration.
@Entity('app_settings')
export class AppSetting {
  @PrimaryColumn()
  key: string;

  @Column()
  value: string;
}
