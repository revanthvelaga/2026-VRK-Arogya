import { IsUUID, ValidateIf } from 'class-validator';

export class AssignAgentDto {
  // Explicit null clears the assignment (e.g. the agent called in sick and
  // the booking needs to go back to unassigned) — IsOptional() alone
  // wouldn't accept that, since it only skips validation for `undefined`.
  @ValidateIf((o) => o.agentId !== null)
  @IsUUID()
  agentId: string | null;
}
