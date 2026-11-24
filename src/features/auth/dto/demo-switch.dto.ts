import { IsEnum } from 'class-validator';
import { RoleName } from '../../../common/enums/domain.enums.js';

/**
 * Quick demo role switcher payload for Hackathon presentation.
 */
export class DemoSwitchDto {
  /** Vai trò demo muốn chuyển (CITIZEN, STAFF, VOLUNTEER) */
  @IsEnum(RoleName)
  role: RoleName;
}

