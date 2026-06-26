import { IsNumber, Max, Min } from 'class-validator';

export class EstimateTripDto {
  @IsNumber()
  @Min(-90) @Max(90)
  originLat: number;

  @IsNumber()
  @Min(-180) @Max(180)
  originLng: number;

  @IsNumber()
  @Min(-90) @Max(90)
  destinationLat: number;

  @IsNumber()
  @Min(-180) @Max(180)
  destinationLng: number;
}
