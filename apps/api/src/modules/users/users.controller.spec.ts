import { ALLOW_UNVERIFIED_PHONE_KEY } from '../../common/decorators/allow-unverified-phone.decorator';
import { UsersController } from './users.controller';

// The real service pulls in ESM-only auth dependencies Jest does not transform,
// and only the route metadata is under test here.
jest.mock('./users.service', () => ({ UsersService: class {} }));

describe('UsersController', () => {
  it('lets an account with no verified phone delete itself', () => {
    // Store policy: every account must be deletable. A Google or Apple sign-up
    // that never verified a phone would otherwise be refused by the phone gate.
    const handler = UsersController.prototype.deleteMe;
    expect(Reflect.getMetadata(ALLOW_UNVERIFIED_PHONE_KEY, handler)).toBe(true);
  });
});
