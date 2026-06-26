import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from './entities/user.entity';
import { EmergencyContact } from './entities/emergency-contact.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateFcmTokenDto } from './dto/update-fcm-token.dto';
import { CreateEmergencyContactDto } from './dto/emergency-contact.dto';

const MAX_EMERGENCY_CONTACTS = 3;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,

    @InjectRepository(EmergencyContact)
    private contactRepository: Repository<EmergencyContact>,
  ) {}

  // ─── Perfil ───────────────────────────────────────────────────────────────────

  async findById(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    if (dto.email) {
      const existing = await this.userRepository.findOne({
        where: { email: dto.email },
      });
      if (existing && existing.id !== userId) {
        throw new ConflictException('El email ya está en uso');
      }
    }

    await this.userRepository.update(userId, {
      name: dto.name,
      email: dto.email,
      avatarUrl: dto.avatarUrl,
    });

    return this.findById(userId);
  }

  async updateFcmToken(userId: string, dto: UpdateFcmTokenDto): Promise<void> {
    await this.userRepository.update(userId, { fcmToken: dto.fcmToken });
  }

  async deleteAccount(userId: string): Promise<void> {
    const user = await this.findById(userId);

    // Anonimiza en vez de borrar para mantener integridad de viajes históricos
    await this.userRepository.update(userId, {
      name: 'Usuario eliminado',
      email: undefined,
      avatarUrl: undefined,
      fcmToken: undefined,
      status: UserStatus.BANNED,
      phone: `deleted_${user.id}`,
    });
  }

  // ─── Contactos de emergencia ──────────────────────────────────────────────────

  async getEmergencyContacts(userId: string): Promise<EmergencyContact[]> {
    return this.contactRepository.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
  }

  async addEmergencyContact(
    userId: string,
    dto: CreateEmergencyContactDto,
  ): Promise<EmergencyContact> {
    const count = await this.contactRepository.count({ where: { userId } });

    if (count >= MAX_EMERGENCY_CONTACTS) {
      throw new BadRequestException(
        `Podés tener hasta ${MAX_EMERGENCY_CONTACTS} contactos de emergencia`,
      );
    }

    const contact = this.contactRepository.create({
      userId,
      name: dto.name,
      phone: dto.phone,
    });

    return this.contactRepository.save(contact);
  }

  async removeEmergencyContact(userId: string, contactId: string): Promise<void> {
    const contact = await this.contactRepository.findOne({
      where: { id: contactId, userId },
    });

    if (!contact) throw new NotFoundException('Contacto no encontrado');

    await this.contactRepository.remove(contact);
  }
}
