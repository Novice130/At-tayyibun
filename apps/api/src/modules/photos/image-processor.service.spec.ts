import type Sharp from 'sharp';
import { ImageProcessorService } from './image-processor.service';

// See the note in image-processor.service.ts on why sharp is required.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp: typeof Sharp = require('sharp');

const image = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } } });

describe('ImageProcessorService', () => {
  let service: ImageProcessorService;

  beforeEach(() => {
    service = new ImageProcessorService();
  });

  describe('processImage', () => {
    it('produces WebP thumbnail, display and original versions without metadata', async () => {
      const input = await image(10, 10)
        .jpeg()
        .withExif({ IFD0: { Copyright: 'uploader', Software: 'camera' } })
        .toBuffer();
      expect((await sharp(input).metadata()).exif).toBeDefined();

      const { thumbnail, display, original } = await service.processImage(input);

      const thumb = await sharp(thumbnail).metadata();
      expect(thumb).toMatchObject({ format: 'webp', width: 150, height: 150 });

      const disp = await sharp(display).metadata();
      expect(disp).toMatchObject({ format: 'webp', width: 10, height: 10 });

      const orig = await sharp(original).metadata();
      expect(orig).toMatchObject({ format: 'webp', width: 10, height: 10 });

      for (const meta of [thumb, disp, orig]) {
        expect(meta.exif).toBeUndefined();
        expect(meta.icc).toBeUndefined();
        expect(meta.xmp).toBeUndefined();
      }
    });

    it('scales the display version down to fit inside 600px, keeping aspect ratio', async () => {
      const input = await image(1200, 800).png().toBuffer();

      const { thumbnail, display, original } = await service.processImage(input);

      await expect(sharp(display).metadata()).resolves.toMatchObject({ width: 600, height: 400 });
      await expect(sharp(thumbnail).metadata()).resolves.toMatchObject({ width: 150, height: 150 });
      await expect(sharp(original).metadata()).resolves.toMatchObject({ width: 1200, height: 800 });
    });

    it('rejects data that is not an image', async () => {
      await expect(service.processImage(Buffer.from('not an image'))).rejects.toThrow();
    });
  });

  describe('validateImage', () => {
    it('accepts a JPEG of at least 200x200', async () => {
      const input = await image(200, 200).jpeg().toBuffer();
      await expect(service.validateImage(input)).resolves.toEqual({ valid: true });
    });

    it('rejects an image smaller than 200x200', async () => {
      const input = await image(10, 10).png().toBuffer();
      await expect(service.validateImage(input)).resolves.toMatchObject({
        valid: false,
        error: expect.stringContaining('too small'),
      });
    });

    it('rejects a format outside the allow-list', async () => {
      const input = await image(200, 200).gif().toBuffer();
      await expect(service.validateImage(input)).resolves.toMatchObject({
        valid: false,
        error: expect.stringContaining('Invalid image format'),
      });
    });

    it('rejects a buffer over the size limit', async () => {
      const input = await image(200, 200).png().toBuffer();
      const halfSizeMB = input.length / (1024 * 1024) / 2;
      await expect(service.validateImage(input, halfSizeMB)).resolves.toMatchObject({
        valid: false,
        error: expect.stringContaining('exceeds'),
      });
    });

    it('rejects corrupted data', async () => {
      await expect(service.validateImage(Buffer.from('not an image'))).resolves.toEqual({
        valid: false,
        error: 'Invalid or corrupted image file',
      });
    });
  });
});
