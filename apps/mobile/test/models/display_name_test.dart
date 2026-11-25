import 'package:flutter_test/flutter_test.dart';
import 'package:at_tayyibun/models/info_request.dart';
import 'package:at_tayyibun/models/profile.dart';

void main() {
  group('ProfileSummary.fromJson', () {
    test('uses displayName and phoneVerified from the API', () {
      final p = ProfileSummary.fromJson({
        'publicId': 'AT-123456',
        'firstName': null,
        'displayName': 'Sister 4821',
        'phoneVerified': true,
        'city': 'Lorton',
        'state': 'VA',
      });
      expect(p.displayName, 'Sister 4821');
      expect(p.phoneVerified, isTrue);
      expect(p.location, 'Lorton, VA');
    });

    test('falls back to firstName, then Member, never the publicId', () {
      final named = ProfileSummary.fromJson({
        'publicId': 'AT-123456',
        'firstName': 'Aisha',
      });
      expect(named.displayName, 'Aisha');
      expect(named.phoneVerified, isFalse);

      final hidden = ProfileSummary.fromJson({
        'publicId': 'AT-123456',
        'firstName': null,
        'displayName': '',
      });
      expect(hidden.displayName, 'Member');
      expect(hidden.displayName, isNot(contains('AT-123456')));
    });

    test('formats old lower-case location data', () {
      final p = ProfileSummary.fromJson({
        'publicId': 'AT-1',
        'city': 'lorton',
        'state': 'va',
      });
      expect(p.location, 'Lorton, VA');
    });
  });

  group('RequestParty.fromJson', () {
    test('reads displayName and phoneVerified on the party', () {
      final party = RequestParty.fromJson({
        'publicId': 'AT-9',
        'displayName': 'Brother 1203',
        'phoneVerified': true,
        'profile': {'firstName': null, 'city': 'lorton', 'state': 'va'},
      });
      expect(party.displayName, 'Brother 1203');
      expect(party.phoneVerified, isTrue);
      expect(party.location, 'Lorton, VA');
    });

    test('falls back to the nested firstName, then Member', () {
      final named = RequestParty.fromJson({
        'publicId': 'AT-9',
        'profile': {'firstName': 'Yusuf'},
      });
      expect(named.displayName, 'Yusuf');
      expect(named.phoneVerified, isFalse);

      final hidden = RequestParty.fromJson({'publicId': 'AT-9'});
      expect(hidden.displayName, 'Member');
    });
  });

  group('MyProfile.fromJson', () {
    test('parses displayName and phoneVerified with fallbacks', () {
      final withAlias = MyProfile.fromJson({
        'publicId': 'AT-1',
        'displayName': 'Sister 4821',
        'phoneVerified': true,
        'profile': {'firstName': 'Aisha'},
      });
      expect(withAlias.displayName, 'Sister 4821');
      expect(withAlias.phoneVerified, isTrue);

      final older = MyProfile.fromJson({
        'publicId': 'AT-1',
        'profile': {'firstName': 'Aisha'},
      });
      expect(older.displayName, 'Aisha');
      expect(older.phoneVerified, isFalse);

      expect(MyProfile.fromJson({'publicId': 'AT-1'}).displayName, 'Member');
    });
  });
}
