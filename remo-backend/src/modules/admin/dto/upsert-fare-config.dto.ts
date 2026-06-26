import { IsNumber, IsPositive, Max, Min } from 'class-validator';

export class UpsertFareConfigDto {
  @IsNumber()
  @IsPositive()
  baseFare: number;

  @IsNumber()
  @IsPositive()
  pricePerKm: number;

  @IsNumber()
  @IsPositive()
  pricePerMin: number;

  @IsNumber()
  @Min(0)
  @Max(50)
  platformCommissionPct: number;
}
