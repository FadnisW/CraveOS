import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { AuthenticatedActor } from '../../common/types/authenticated-actor';

export interface UpsertAddressDto {
  id?: string;
  type?: 'home' | 'work' | 'other';
  label?: string;
  addressLine: string;
  landmark?: string;
  city?: string;
  pincode?: string;
  lat: number;
  lng: number;
  resolvedHubId?: string;
  isDefault?: boolean;
}

const ADDRESS_TYPES = new Set(['home', 'work', 'other']);

@Injectable()
export class AddressesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogService: CatalogService,
  ) {}

  /**
   * Lists the caller's saved addresses, default first.
   */
  async listAddresses(actor: AuthenticatedActor) {
    const addresses = await this.prisma.address.findMany({
      where: { userId: this.requireActor(actor) },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    return addresses.map((address) => this.serialize(address));
  }

  /**
   * Creates an address for the caller.
   *
   * The delivery hub is resolved from the coordinates on the server. A client
   * cannot point an address at an arbitrary hub it is not actually served by.
   */
  async createAddress(dto: UpsertAddressDto, actor: AuthenticatedActor) {
    const userId = this.requireActor(actor);
    const validated = await this.validate(dto);

    const created = await this.prisma.$transaction(async (tx) => {
      if (validated.isDefault) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }

      const count = await tx.address.count({ where: { userId } });

      return tx.address.create({
        data: {
          userId,
          ...validated,
          isDefault: validated.isDefault ?? count === 0,
        },
      });
    });

    return this.serialize(created);
  }

  /**
   * Idempotent address provisioning used by checkout.
   *
   * The storefront keeps a local address book, but orders can only reference
   * rows that exist in the database and belong to the buyer. This creates the
   * address once (keyed by its address line) and returns the canonical row on
   * every subsequent checkout.
   */
  async ensureAddress(dto: UpsertAddressDto, actor: AuthenticatedActor) {
    const userId = this.requireActor(actor);

    if (!dto?.addressLine) {
      throw new BadRequestException('addressLine is required');
    }

    const existing = await this.prisma.address.findFirst({
      where: { userId, addressLine: dto.addressLine.trim() },
    });

    if (existing) {
      return this.serialize(existing);
    }

    return this.createAddress(dto, actor);
  }

  async updateAddress(id: string, dto: Partial<UpsertAddressDto>, actor: AuthenticatedActor) {
    const userId = this.requireActor(actor);
    const existing = await this.prisma.address.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`Address ${id} not found`);
    }

    if (existing.userId !== userId && actor?.role !== 'ADMIN') {
      throw new ForbiddenException('This address does not belong to you');
    }

    const validated = await this.validate({
      ...existing,
      ...dto,
      addressLine: dto.addressLine ?? existing.addressLine,
      lat: dto.lat ?? existing.lat,
      lng: dto.lng ?? existing.lng,
    } as UpsertAddressDto);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (validated.isDefault) {
        await tx.address.updateMany({
          where: { userId: existing.userId },
          data: { isDefault: false },
        });
      }

      return tx.address.update({
        where: { id },
        data: validated,
      });
    });

    return this.serialize(updated);
  }

  async deleteAddress(id: string, actor: AuthenticatedActor) {
    const userId = this.requireActor(actor);
    const existing = await this.prisma.address.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`Address ${id} not found`);
    }

    if (existing.userId !== userId && actor?.role !== 'ADMIN') {
      throw new ForbiddenException('This address does not belong to you');
    }

    const orderCount = await this.prisma.order.count({ where: { addressId: id } });
    if (orderCount > 0) {
      // Deleting would cascade-destroy order history.
      throw new BadRequestException(
        'This address is attached to past orders and cannot be deleted. Edit it instead.',
      );
    }

    await this.prisma.address.delete({ where: { id } });
    return { success: true, id };
  }

  /** Maps the database enum back to the lowercase shape the storefront uses. */
  private serialize<T extends { type: string }>(address: T) {
    return { ...address, type: address.type.toLowerCase() };
  }

  private requireActor(actor: AuthenticatedActor): string {
    if (!actor?.sub) {
      throw new ForbiddenException('Authentication required');
    }
    if (actor.role === 'RIDER') {
      throw new ForbiddenException('Rider accounts do not have delivery addresses');
    }
    return actor.sub;
  }

  /**
   * Validates the payload and resolves the serviceable hub from coordinates.
   */
  private async validate(dto: UpsertAddressDto) {
    if (!dto?.addressLine || dto.addressLine.trim().length < 5) {
      throw new BadRequestException('A full street address is required');
    }

    const lat = Number(dto.lat);
    const lng = Number(dto.lng);

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      throw new BadRequestException('lat must be a valid latitude');
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw new BadRequestException('lng must be a valid longitude');
    }

    // The database enum is HOME / WORK / OTHER; the storefront speaks
    // lowercase. Normalise on the way in and serialise back on the way out.
    const requestedType = String(dto.type || 'home').toLowerCase();
    const type = ADDRESS_TYPES.has(requestedType) ? requestedType : 'home';

    const serviceability = await this.catalogService.resolveHubByCoords(lat, lng);
    if (!serviceability?.isServiceable || !serviceability.hubId) {
      throw new BadRequestException(
        serviceability?.message ||
          'Eatclub does not deliver to these coordinates yet. Please pick another address.',
      );
    }

    // A pincode is part of a deliverable address, not decoration. Never invent
    // one when the customer leaves the field blank.
    const pincode = String(dto.pincode || '').trim();
    if (!/^\d{6}$/.test(pincode)) {
      throw new BadRequestException('Enter the 6-digit pincode for this address');
    }

    // The resolved hub always wins over a client-supplied one. The hub's city
    // is authoritative; a client cannot label an HSR address as another city.
    return {
      type: type.toUpperCase() as 'HOME' | 'WORK' | 'OTHER',
      label: dto.label?.trim() || (type === 'home' ? 'Home' : type === 'work' ? 'Work' : 'Other'),
      addressLine: dto.addressLine.trim(),
      landmark: dto.landmark?.trim() || null,
      city: serviceability.city,
      pincode,
      lat,
      lng,
      resolvedHubId: serviceability.hubId,
      isDefault: dto.isDefault ?? false,
    };
  }
}
