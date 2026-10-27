import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProfileDto } from './index';

async function errorsFor(body: Record<string, unknown>): Promise<string[]> {
  // Same transform options as the global ValidationPipe in main.ts.
  const dto = plainToInstance(UpdateProfileDto, body, { enableImplicitConversion: true });
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  return errors.map((e) => e.property);
}

describe('UpdateProfileDto marital answers', () => {
  it('accepts the answers when omitted', async () => {
    expect(await errorsFor({ firstName: 'Aisha' })).toEqual([]);
  });

  it('accepts valid answers', async () => {
    expect(
      await errorsFor({
        maritalStatus: 'DIVORCED',
        hasChildren: true,
        childrenCount: 2,
        openToDivorced: true,
        openToWidowed: false,
        openToChildren: true,
      }),
    ).toEqual([]);
  });

  it('rejects null for maritalStatus (answers can be changed, never cleared)', async () => {
    expect(await errorsFor({ maritalStatus: null })).toEqual(['maritalStatus']);
  });

  it('rejects null for hasChildren', async () => {
    expect(await errorsFor({ hasChildren: null })).toEqual(['hasChildren']);
  });

  it('rejects null for the open-to answers (not-null columns)', async () => {
    expect(await errorsFor({ openToDivorced: null, openToWidowed: null, openToChildren: null })).toEqual([
      'openToDivorced',
      'openToWidowed',
      'openToChildren',
    ]);
  });

  it('rejects a married value', async () => {
    expect(await errorsFor({ maritalStatus: 'MARRIED' })).toEqual(['maritalStatus']);
  });

  it('still accepts null childrenCount', async () => {
    expect(await errorsFor({ hasChildren: false, childrenCount: null })).toEqual([]);
  });
});
