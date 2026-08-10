import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api_exception.dart';
import '../core/constants.dart';
import '../providers.dart';
import '../widgets/states.dart';

/// Keys this form owns inside the `biodata` blob. Anything else found on the
/// server (guardian details captured at signup) is preserved untouched — the
/// API replaces the whole encrypted blob on every write.
const _ownedBiodataKeys = {
  'hideLocation', 'hideName', 'legalStatus', 'education', 'profession',
  'relocate', 'religiousPractice', 'prayerFrequency', 'dietaryPreference',
  'sect', 'partnerPreferences', 'dealBreakers', 'nikahIntent',
};

class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  final _pageKeys = List.generate(5, (_) => GlobalKey<FormState>());

  int _step = 0;
  bool _loading = true;
  bool _saving = false;
  String? _error;

  Map<String, dynamic> _extraBiodata = {};

  final _firstName = TextEditingController();
  final _lastName = TextEditingController();
  final _city = TextEditingController();
  final _ethnicity = TextEditingController();
  final _education = TextEditingController();
  final _profession = TextEditingController();
  final _sect = TextEditingController();
  final _about = TextEditingController();
  final _partnerPreferences = TextEditingController();
  final _dealBreakers = TextEditingController();

  String? _gender;
  String? _state;
  DateTime? _dob;
  String? _legalStatus;
  String? _relocate;
  String? _religiousPractice;
  String? _prayerFrequency;
  String? _dietaryPreference;
  bool _hideLocation = false;
  bool _hideName = false;
  bool _nikahIntent = false;

  @override
  void initState() {
    super.initState();
    _hydrate();
  }

  @override
  void dispose() {
    for (final c in [
      _firstName, _lastName, _city, _ethnicity, _education, _profession,
      _sect, _about, _partnerPreferences, _dealBreakers,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  /// Load every saved field back into the form. The website shipped without
  /// this, which is why the client reported "it said saved but saved nothing".
  Future<void> _hydrate() async {
    try {
      final me = await ref.read(profilesRepositoryProvider).me();
      final p = me.profile;
      if (p != null) {
        final bd = p.biodata;
        _extraBiodata = Map.fromEntries(
          bd.entries.where((e) => !_ownedBiodataKeys.contains(e.key)),
        );

        _firstName.text = p.firstName;
        _lastName.text = p.lastName;
        _city.text = p.city ?? '';
        _about.text = p.bio ?? '';
        _gender = p.gender;
        _state = kUsStates.contains(p.state) ? p.state : null;
        if (p.profileComplete) {
          // Pre-seed rows carry placeholder dob/ethnicity until the wizard has
          // been completed once.
          _ethnicity.text = p.ethnicity;
          _dob = p.dob == null ? null : DateTime.tryParse(p.dob!);
        }

        _education.text = _str(bd['education']);
        _profession.text = _str(bd['profession']);
        _sect.text = _str(bd['sect']);
        _partnerPreferences.text = _str(bd['partnerPreferences']);
        _dealBreakers.text = _str(bd['dealBreakers']);
        _legalStatus = _opt(bd['legalStatus'], _legalStatuses);
        _relocate = _opt(bd['relocate'], _relocateOptions);
        _religiousPractice = _opt(bd['religiousPractice'], _practices);
        _prayerFrequency = _opt(bd['prayerFrequency'], _prayerOptions);
        _dietaryPreference = _opt(bd['dietaryPreference'], _dietOptions);
        _hideLocation = bd['hideLocation'] == true;
        _hideName = bd['hideName'] == true;
        _nikahIntent = bd['nikahIntent'] == true;
      }
    } on ApiException catch (e) {
      _error = e.message;
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  static String _str(Object? v) => v == null ? '' : v.toString();

  static String? _opt(Object? v, List<String> allowed) {
    final s = v?.toString();
    return (s != null && allowed.contains(s)) ? s : null;
  }

  static const _legalStatuses = [
    'Citizen', 'Permanent Resident', 'Work Visa', 'Student Visa', 'Other',
  ];
  static const _relocateOptions = ['Yes', 'No', 'Open to Discussion'];
  static const _practices = ['Practicing', 'Striving', 'Moderate'];
  static const _prayerOptions = ['5 times daily', 'Most prayers', 'Occasionally'];
  static const _dietOptions = ['Halal only', 'Halal + Vegetarian', 'No restrictions'];
  static const _educationOptions = [
    'High School', 'Some College', "Bachelor's", "Master's", 'Doctorate',
    'Medical / JD', 'Vocational / Trade', 'Other',
  ];

  int get _age {
    if (_dob == null) return 0;
    final now = DateTime.now();
    var age = now.year - _dob!.year;
    if (now.month < _dob!.month ||
        (now.month == _dob!.month && now.day < _dob!.day)) {
      age--;
    }
    return age;
  }

  String? _validateStep() {
    switch (_step) {
      case 0:
        if (_gender == null) return 'Please select a gender.';
        if (_firstName.text.trim().length < 2) return 'First name is required.';
        if (_lastName.text.trim().length < 2) return 'Last name is required.';
        if (_dob == null) return 'Date of birth is required.';
        if (_age < 18) return 'Must be at least 18 years old.';
        if (_city.text.trim().isEmpty) return 'City is required.';
        if (_state == null) return 'State is required.';
        if (_ethnicity.text.trim().isEmpty) return 'Ethnicity is required.';
      case 1:
        if (_legalStatus == null) return 'Legal status is required.';
        if (_education.text.trim().isEmpty) return 'Education is required.';
        if (_profession.text.trim().isEmpty) return 'Profession is required.';
        if (_relocate == null) return 'Willingness to relocate is required.';
      case 2:
        if (_religiousPractice == null) return 'Religious practice is required.';
        if (_prayerFrequency == null) return 'Prayer frequency is required.';
        if (_dietaryPreference == null) return 'Dietary preference is required.';
      case 3:
        if (_about.text.trim().length < 30) {
          return 'Please write at least 30 characters about the candidate.';
        }
        if (_partnerPreferences.text.trim().length < 20) {
          return 'Please describe partner preferences (min 20 characters).';
        }
      case 4:
        if (!_nikahIntent) return 'Please confirm your intent before saving.';
    }
    return null;
  }

  Future<void> _next() async {
    final error = _validateStep();
    if (error != null) {
      setState(() => _error = error);
      return;
    }
    setState(() => _error = null);
    if (_step < 4) {
      setState(() => _step++);
      return;
    }
    await _save();
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(profilesRepositoryProvider).update(
        firstName: _firstName.text.trim(),
        lastName: _lastName.text.trim(),
        dob: _dob!.toIso8601String().substring(0, 10),
        gender: _gender,
        ethnicity: _ethnicity.text.trim(),
        city: _city.text.trim(),
        state: _state,
        bio: _about.text.trim(),
        biodata: {
          ..._extraBiodata,
          'hideLocation': _hideLocation,
          'hideName': _hideName,
          'legalStatus': _legalStatus,
          'education': _education.text.trim(),
          'profession': _profession.text.trim(),
          'relocate': _relocate,
          'religiousPractice': _religiousPractice,
          'prayerFrequency': _prayerFrequency,
          'dietaryPreference': _dietaryPreference,
          'sect': _sect.text.trim().isEmpty ? null : _sect.text.trim(),
          'partnerPreferences': _partnerPreferences.text.trim(),
          'dealBreakers': _dealBreakers.text.trim(),
          'nikahIntent': _nikahIntent,
        },
      );
      ref.invalidate(myProfileProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Profile saved.')));
      Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: LoadingView());
    }

    const titles = [
      'Basic Info', 'Background', 'Deen & Practice', 'About You', 'Confirm',
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text(titles[_step]),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(4),
          child: LinearProgressIndicator(value: (_step + 1) / 5),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Form(
                  key: _pageKeys[_step],
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (_error != null) ...[
                        _ErrorBanner(message: _error!),
                        const SizedBox(height: 16),
                      ],
                      ..._stepFields(),
                    ],
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  if (_step > 0)
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _saving
                            ? null
                            : () => setState(() {
                                  _step--;
                                  _error = null;
                                }),
                        child: const Text('Back'),
                      ),
                    ),
                  if (_step > 0) const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      onPressed: _saving ? null : _next,
                      child: _saving
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2))
                          : Text(_step == 4 ? 'Save Profile' : 'Continue'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _stepFields() => switch (_step) {
        0 => _basicFields(),
        1 => _backgroundFields(),
        2 => _deenFields(),
        3 => _aboutFields(),
        _ => _confirmFields(),
      };

  List<Widget> _basicFields() => [
        _Label('Gender'),
        SegmentedButton<String>(
          segments: const [
            ButtonSegment(value: 'MALE', label: Text('Brother')),
            ButtonSegment(value: 'FEMALE', label: Text('Sister')),
          ],
          selected: _gender == null ? {} : {_gender!},
          emptySelectionAllowed: true,
          onSelectionChanged: (s) =>
              setState(() => _gender = s.isEmpty ? null : s.first),
        ),
        const SizedBox(height: 16),
        TextFormField(
          controller: _firstName,
          textCapitalization: TextCapitalization.words,
          decoration: const InputDecoration(labelText: 'First name'),
        ),
        const SizedBox(height: 16),
        TextFormField(
          controller: _lastName,
          textCapitalization: TextCapitalization.words,
          decoration: const InputDecoration(labelText: 'Last name'),
        ),
        const SizedBox(height: 16),
        InkWell(
          onTap: () async {
            final now = DateTime.now();
            final picked = await showDatePicker(
              context: context,
              initialDate: _dob ?? DateTime(now.year - 25),
              firstDate: DateTime(now.year - 80),
              lastDate: DateTime(now.year - 18, now.month, now.day),
            );
            if (picked != null) setState(() => _dob = picked);
          },
          child: InputDecorator(
            decoration: const InputDecoration(labelText: 'Date of birth'),
            child: Text(
              _dob == null
                  ? 'Select a date'
                  : '${_dob!.year}-${_dob!.month.toString().padLeft(2, '0')}-${_dob!.day.toString().padLeft(2, '0')}  ($_age)',
            ),
          ),
        ),
        const SizedBox(height: 16),
        TextFormField(
          controller: _city,
          decoration: const InputDecoration(labelText: 'City'),
        ),
        const SizedBox(height: 16),
        DropdownButtonFormField<String>(
          initialValue: _state,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'State'),
          items: kUsStates
              .map((s) => DropdownMenuItem(value: s, child: Text(s)))
              .toList(),
          onChanged: (v) => setState(() => _state = v),
        ),
        const SizedBox(height: 16),
        TextFormField(
          controller: _ethnicity,
          decoration: const InputDecoration(
            labelText: 'Ethnicity / background',
            hintText: 'e.g. South Asian',
          ),
        ),
        const SizedBox(height: 8),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          value: _hideName,
          onChanged: (v) => setState(() => _hideName = v),
          title: const Text('Hide my name'),
          subtitle: const Text('Show only your anonymous ID in Browse'),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          value: _hideLocation,
          onChanged: (v) => setState(() => _hideLocation = v),
          title: const Text('Hide my location'),
          subtitle: const Text('Hide city and state from other members'),
        ),
      ];

  List<Widget> _backgroundFields() => [
        _Label('Legal status'),
        _ChoiceChips(
          options: _legalStatuses,
          selected: _legalStatus,
          onSelected: (v) => setState(() => _legalStatus = v),
        ),
        const SizedBox(height: 16),
        DropdownButtonFormField<String>(
          initialValue: _educationOptions.contains(_education.text)
              ? _education.text
              : null,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'Education level'),
          items: _educationOptions
              .map((e) => DropdownMenuItem(value: e, child: Text(e)))
              .toList(),
          onChanged: (v) => setState(() => _education.text = v ?? ''),
        ),
        const SizedBox(height: 16),
        TextFormField(
          controller: _profession,
          decoration: const InputDecoration(
            labelText: 'Profession',
            hintText: 'e.g. Software Engineer',
          ),
        ),
        const SizedBox(height: 16),
        _Label('Willingness to relocate'),
        _ChoiceChips(
          options: _relocateOptions,
          selected: _relocate,
          onSelected: (v) => setState(() => _relocate = v),
        ),
      ];

  List<Widget> _deenFields() => [
        _Label('Religious practice'),
        _ChoiceChips(
          options: _practices,
          selected: _religiousPractice,
          onSelected: (v) => setState(() => _religiousPractice = v),
        ),
        const SizedBox(height: 16),
        _Label('Prayer'),
        _ChoiceChips(
          options: _prayerOptions,
          selected: _prayerFrequency,
          onSelected: (v) => setState(() => _prayerFrequency = v),
        ),
        const SizedBox(height: 16),
        _Label('Dietary preference'),
        _ChoiceChips(
          options: _dietOptions,
          selected: _dietaryPreference,
          onSelected: (v) => setState(() => _dietaryPreference = v),
        ),
        const SizedBox(height: 16),
        TextFormField(
          controller: _sect,
          decoration: const InputDecoration(
            labelText: 'Sect (optional)',
            hintText: 'e.g. Sunni / Hanafi',
          ),
        ),
      ];

  List<Widget> _aboutFields() => [
        TextFormField(
          controller: _about,
          maxLines: 6,
          maxLength: 2000,
          decoration: const InputDecoration(
            labelText: 'About',
            alignLabelWithHint: true,
            hintText: 'Tell families about the candidate…',
          ),
        ),
        const SizedBox(height: 8),
        TextFormField(
          controller: _partnerPreferences,
          maxLines: 4,
          decoration: const InputDecoration(
            labelText: 'Partner preferences',
            alignLabelWithHint: true,
          ),
        ),
        const SizedBox(height: 16),
        TextFormField(
          controller: _dealBreakers,
          maxLines: 3,
          decoration: const InputDecoration(
            labelText: 'Deal breakers (optional)',
            alignLabelWithHint: true,
          ),
        ),
      ];

  List<Widget> _confirmFields() {
    final rows = <(String, String)>[
      ('Name', '${_firstName.text} ${_lastName.text}'.trim()),
      ('Gender', _gender ?? '—'),
      ('Age', _age > 0 ? '$_age' : '—'),
      ('Location', [_city.text, _state].where((e) => e != null && e.isNotEmpty).join(', ')),
      ('Ethnicity', _ethnicity.text),
      ('Education', _education.text),
      ('Profession', _profession.text),
      ('Legal status', _legalStatus ?? '—'),
      ('Relocate', _relocate ?? '—'),
      ('Practice', _religiousPractice ?? '—'),
      ('Prayer', _prayerFrequency ?? '—'),
      ('Diet', _dietaryPreference ?? '—'),
    ];

    return [
      Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              for (final (label, value) in rows)
                if (value.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 5),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SizedBox(width: 110, child: Text(label)),
                        Expanded(
                          child: Text(
                            value,
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                  ),
            ],
          ),
        ),
      ),
      const SizedBox(height: 16),
      CheckboxListTile(
        contentPadding: EdgeInsets.zero,
        value: _nikahIntent,
        onChanged: (v) => setState(() => _nikahIntent = v ?? false),
        title: const Text('I confirm this profile is created with a sincere '
            'intention for nikah, and the information given is accurate.'),
      ),
    ];
  }
}

class _Label extends StatelessWidget {
  const _Label(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(text, style: Theme.of(context).textTheme.labelLarge),
      );
}

/// Wrapping chips instead of a fixed 3-column grid — long labels like
/// "Open to Discussion" broke the web layout on narrow screens.
class _ChoiceChips extends StatelessWidget {
  const _ChoiceChips({
    required this.options,
    required this.selected,
    required this.onSelected,
  });

  final List<String> options;
  final String? selected;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) => Wrap(
        spacing: 8,
        runSpacing: 8,
        children: options
            .map(
              (o) => ChoiceChip(
                label: Text(o),
                selected: selected == o,
                onSelected: (_) => onSelected(o),
              ),
            )
            .toList(),
      );
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: theme.colorScheme.error.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: theme.colorScheme.error.withValues(alpha: 0.3)),
      ),
      child: Text(message, style: TextStyle(color: theme.colorScheme.error)),
    );
  }
}
