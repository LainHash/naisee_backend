import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { MediaStage, RoleName } from '../../common/enums/domain.enums.js';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface.js';
import type { CloudinaryService } from './cloudinary.service.js';
import {
  MediaController,
  type UploadedImageFile,
} from './media.controller.js';

describe('MediaController', () => {
  const mockFile: UploadedImageFile = {
    buffer: Buffer.from('fake-image-bytes'),
    mimetype: 'image/png',
    originalname: 'test.png',
    size: 16,
  };

  function createController() {
    const uploadImage = vi
      .fn()
      .mockResolvedValue(
        'https://res.cloudinary.com/demo/image/upload/v1/naisee/before/sample.png',
      );
    const cloudinaryService = {
      uploadImage,
    } as unknown as CloudinaryService;

    return {
      controller: new MediaController(cloudinaryService),
      uploadImage,
    };
  }

  it('allows guest upload for BEFORE stage and returns Cloudinary URL', async () => {
    const { controller, uploadImage } = createController();

    const result = await controller.upload(
      mockFile,
      { stage: MediaStage.BEFORE },
      undefined,
    );

    expect(uploadImage).toHaveBeenCalledWith(
      mockFile.buffer,
      MediaStage.BEFORE,
    );
    expect(result).toEqual({
      url: 'https://res.cloudinary.com/demo/image/upload/v1/naisee/before/sample.png',
      stage: MediaStage.BEFORE,
    });
  });

  it('rejects unauthenticated upload for AFTER stage with 401', async () => {
    const { controller } = createController();

    await expect(
      controller.upload(mockFile, { stage: MediaStage.AFTER }, undefined),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects CITIZEN upload for VERIFICATION stage with 403', async () => {
    const { controller } = createController();
    const citizen: AuthenticatedUser = {
      id: 1,
      publicId: 'uuid-1',
      role: RoleName.CITIZEN,
      fullName: 'Cô/Chú Minh',
      phone: '0901000001',
      ward: 'Phường Trấn Biên',
      departmentId: null,
    };

    await expect(
      controller.upload(mockFile, { stage: MediaStage.VERIFICATION }, citizen),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws BadRequestException when file is missing', async () => {
    const { controller } = createController();

    await expect(
      controller.upload(undefined, { stage: MediaStage.BEFORE }, undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
