/// Display labels for the profile-detail fields stored inside the encrypted
/// `biodata` blob. Shared by the owner's own profile screen and the potential
/// match detail screen so the two can't drift.
const kBiodataLabels = <String, String>{
  'education': 'Education',
  'profession': 'Profession',
  'legalStatus': 'Legal Status',
  'relocate': 'Open to Relocate',
  'religiousPractice': 'Religious Practice',
  'prayerFrequency': 'Prayer',
  'dietaryPreference': 'Diet',
  'sect': 'Sect',
};

/// Normalise a raw biodata value for display: booleans become Yes/No, blank
/// strings and nulls return null so callers can skip the row entirely.
String? displayBiodataValue(Object? value) {
  if (value == null) return null;
  if (value is bool) return value ? 'Yes' : 'No';
  final s = value.toString().trim();
  return s.isEmpty ? null : s;
}
