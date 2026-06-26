import { IsEnum, IsNumber, IsString, Max, Min } from 'class-validator';
import { PaymentMethod } from '../entities/trip.entity';

export class CreateTripDto {
  @IsString()
  originAddress: string;

  @IsNumber()
  @Min(-90) @Max(90)
  originLat: number;

  @IsNumber()
  @Min(-180) @Max(180)
  originLng: number;

  @IsString()
  destinationAddress: string;

  @IsNumber()
  @Min(-90) @Max(90)
  destinationLat: number;

  @IsNumber()
  @Min(-180) @Max(180)
  destinationLng: number;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;
}
