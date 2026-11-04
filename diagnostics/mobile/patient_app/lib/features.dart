// Arogya feature screens for the patient app: richer booking (packages,
// collection mode, pickup points, offers, family, wallet), insights,
// wallet & referrals, test finder and family members.
import 'package:flutter/material.dart';
import 'api.dart';

void _snack(BuildContext c, String m) => ScaffoldMessenger.of(c).showSnackBar(SnackBar(content: Text(m)));
double _num(dynamic v) => double.tryParse(v?.toString() ?? '') ?? 0;
int _int(dynamic v) => int.tryParse(v?.toString() ?? '') ?? 0;
String _money(dynamic v) => '₹${_num(v).toStringAsFixed(0)}';

// ------------------------------------------------------------------ Booking
class BookScreen extends StatefulWidget {
  final Set<int> preTests;
  final Set<int> prePackages;
  const BookScreen({super.key, this.preTests = const {}, this.prePackages = const {}});
  @override
  State<BookScreen> createState() => _BookScreenState();
}

class _BookScreenState extends State<BookScreen> {
  List<dynamic> tests = [], packages = [], points = [], family = [], offers = [];
  late final Set<int> selTests = {...widget.preTests};
  late final Set<int> selPackages = {...widget.prePackages};
  final address = TextEditingController();
  final coupon = TextEditingController();
  String mode = 'HOME_VISIT';
  int? pickupId, memberId;
  DateTime? date;
  TimeOfDay? time;
  double discount = 0, walletBalance = 0;
  String? couponMsg;
  bool useWallet = false, busy = false, loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await Future.wait([Api.get('tests'), Api.get('packages'), Api.get('pickup-points'), Api.get('family'), Api.get('coupons'), Api.get('wallet')]);
      if (!mounted) return;
      setState(() {
        tests = r[0]; packages = r[1]; points = r[2]; family = r[3]; offers = r[4];
        walletBalance = _num((r[5] as Map)['balance']);
        loading = false;
      });
    } catch (e) {
      if (mounted) { _snack(context, e.toString()); setState(() => loading = false); }
    }
  }

  double get subtotal =>
      tests.where((t) => selTests.contains(_int(t['id']))).fold(0.0, (s, t) => s + _num(t['price'])) +
      packages.where((p) => selPackages.contains(_int(p['id']))).fold(0.0, (s, p) => s + _num(p['price']));

  double get total {
    var t = (subtotal - discount).clamp(0, double.infinity).toDouble();
    if (useWallet) t = (t - walletBalance).clamp(0, double.infinity).toDouble();
    return t;
  }

  void _itemsChanged() => setState(() { discount = 0; couponMsg = null; });

  Future<void> _applyCoupon() async {
    if (coupon.text.trim().isEmpty) return;
    try {
      final r = await Api.post('coupons/quote', {'code': coupon.text.trim(), 'subtotal': subtotal});
      setState(() { discount = _num(r['discount']); couponMsg = '${r['code']}: you save ${_money(discount)}'; });
    } catch (e) {
      setState(() { discount = 0; couponMsg = e.toString(); });
    }
  }

  String _two(int n) => n.toString().padLeft(2, '0');

  Future<void> _book() async {
    if ((selTests.isEmpty && selPackages.isEmpty) || date == null || time == null) { _snack(context, 'Choose tests, a date and a time'); return; }
    if (mode == 'HOME_VISIT' && address.text.trim().isEmpty) { _snack(context, 'Enter the collection address'); return; }
    if (mode == 'PICKUP_POINT' && pickupId == null) { _snack(context, 'Choose a pickup point'); return; }
    setState(() => busy = true);
    try {
      await Api.post('appointments', {
        'test_ids': selTests.toList(), 'package_ids': selPackages.toList(),
        'scheduled_at': '${date!.year}-${_two(date!.month)}-${_two(date!.day)} ${_two(time!.hour)}:${_two(time!.minute)}',
        'address': address.text.trim(), 'collection_mode': mode, 'pickup_point_id': pickupId,
        'coupon_code': discount > 0 ? coupon.text.trim() : '', 'member_id': memberId, 'use_wallet': useWallet,
      });
      if (!mounted) return;
      _snack(context, 'Appointment booked');
      Navigator.pop(context);
    } catch (e) {
      if (mounted) _snack(context, e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Widget _section(String t) => Padding(padding: const EdgeInsets.fromLTRB(4, 18, 4, 6), child: Text(t, style: Theme.of(context).textTheme.titleMedium));

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Book a test')),
        bottomNavigationBar: SafeArea(child: Padding(padding: const EdgeInsets.all(12), child: Row(children: [
          Expanded(child: Text('Total ${_money(total)}', style: Theme.of(context).textTheme.titleLarge)),
          FilledButton(onPressed: busy || loading ? null : _book, child: const Text('Confirm booking')),
        ]))),
        body: loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(padding: const EdgeInsets.all(12), children: [
                if (packages.isNotEmpty) _section('Health packages'),
                ...packages.map((p) => CheckboxListTile(
                      value: selPackages.contains(_int(p['id'])),
                      title: Text('${p['name']}${p['tier'] != null ? ' · ${p['tier']}' : ''}'),
                      subtitle: Text('${_money(p['price'])} · ${(p['tests'] as List).join(', ')}'),
                      onChanged: (v) { v == true ? selPackages.add(_int(p['id'])) : selPackages.remove(_int(p['id'])); _itemsChanged(); },
                    )),
                _section('Individual tests'),
                ...tests.map((t) => CheckboxListTile(
                      value: selTests.contains(_int(t['id'])),
                      title: Text(t['name'].toString()),
                      subtitle: Text(_money(t['price'])),
                      onChanged: (v) { v == true ? selTests.add(_int(t['id'])) : selTests.remove(_int(t['id'])); _itemsChanged(); },
                    )),
                if (family.isNotEmpty) ...[
                  _section('Who is this for?'),
                  DropdownButtonFormField<int?>(
                    value: memberId,
                    items: [const DropdownMenuItem(value: null, child: Text('Myself')), ...family.map((m) => DropdownMenuItem(value: _int(m['id']), child: Text('${m['full_name']} (${m['relation']})')))],
                    onChanged: (v) => setState(() => memberId = v),
                  ),
                ],
                _section('Sample collection'),
                SegmentedButton<String>(
                  segments: [
                    const ButtonSegment(value: 'HOME_VISIT', label: Text('Home'), icon: Icon(Icons.home_outlined)),
                    if (points.isNotEmpty) const ButtonSegment(value: 'PICKUP_POINT', label: Text('Pickup point'), icon: Icon(Icons.place_outlined)),
                    const ButtonSegment(value: 'WALK_IN', label: Text('Walk-in'), icon: Icon(Icons.storefront_outlined)),
                  ],
                  selected: {mode},
                  onSelectionChanged: (s) => setState(() => mode = s.first),
                ),
                const SizedBox(height: 8),
                if (mode == 'HOME_VISIT') TextField(controller: address, maxLines: 2, decoration: const InputDecoration(labelText: 'Collection address')),
                if (mode == 'PICKUP_POINT')
                  DropdownButtonFormField<int>(
                    value: pickupId,
                    hint: const Text('Choose a pickup point'),
                    items: points.map((p) => DropdownMenuItem(value: _int(p['id']), child: Text('${p['name']}${p['village_name'] != null ? ' — ${p['village_name']}' : ''}'))).toList(),
                    onChanged: (v) => setState(() => pickupId = v),
                  ),
                Row(children: [
                  Expanded(child: OutlinedButton.icon(icon: const Icon(Icons.calendar_today), label: Text(date == null ? 'Date' : '${date!.day}/${date!.month}/${date!.year}'),
                      onPressed: () async {
                        final d = await showDatePicker(context: context, initialDate: DateTime.now().add(const Duration(days: 1)), firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 90)));
                        if (d != null) setState(() => date = d);
                      })),
                  const SizedBox(width: 8),
                  Expanded(child: OutlinedButton.icon(icon: const Icon(Icons.access_time), label: Text(time == null ? 'Time' : time!.format(context)),
                      onPressed: () async {
                        final t = await showTimePicker(context: context, initialTime: const TimeOfDay(hour: 9, minute: 0));
                        if (t != null) setState(() => time = t);
                      })),
                ]),
                _section('Offer code'),
                Row(children: [
                  Expanded(child: TextField(controller: coupon, textCapitalization: TextCapitalization.characters, decoration: const InputDecoration(hintText: 'Enter code'))),
                  TextButton(onPressed: _applyCoupon, child: const Text('Apply')),
                ]),
                if (couponMsg != null) Text(couponMsg!, style: TextStyle(color: discount > 0 ? Colors.teal : Colors.red)),
                Wrap(spacing: 6, children: offers.map((o) => ActionChip(label: Text(o['code'].toString()), onPressed: () { coupon.text = o['code'].toString(); _applyCoupon(); })).toList()),
                if (walletBalance > 0) SwitchListTile(value: useWallet, title: Text('Use wallet balance (${_money(walletBalance)})'), onChanged: (v) => setState(() => useWallet = v)),
                const SizedBox(height: 60),
              ]),
      );
}

// ------------------------------------------------------------------ Insights
class InsightsScreen extends StatelessWidget {
  const InsightsScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Health insights')),
        floatingActionButton: FloatingActionButton.extended(icon: const Icon(Icons.add), label: const Text('Add reading'),
            onPressed: () => showDialog(context: context, builder: (_) => const _VitalDialog())),
        body: FutureBuilder<dynamic>(
          future: Api.get('insights'),
          builder: (c, s) {
            if (s.hasError) return Center(child: Text(s.error.toString()));
            if (!s.hasData) return const Center(child: CircularProgressIndicator());
            final trends = (s.data['lab_trends'] is Map) ? s.data['lab_trends'] as Map : {};
            final retest = (s.data['retest'] as List).where((r) => r['state'] != 'OK').toList();
            final goals = s.data['goals'] as List;
            return ListView(padding: const EdgeInsets.all(12), children: [
              if (retest.isNotEmpty) Card(child: Column(children: [
                const ListTile(title: Text('Time to retest')),
                ...retest.map((r) => ListTile(dense: true, title: Text(r['test_name'].toString()),
                    trailing: Text(r['state'] == 'OVERDUE' ? 'Overdue' : 'Due in ${r['days_left']} d', style: TextStyle(color: r['state'] == 'OVERDUE' ? Colors.red : Colors.orange)))),
              ])),
              Text('Lab results', style: Theme.of(context).textTheme.titleMedium),
              if (trends.isEmpty) const Padding(padding: EdgeInsets.all(16), child: Text('Your results will appear here once the lab enters them.')),
              ...trends.entries.map((e) {
                final rows = e.value as List;
                final last = rows.last;
                final abnormal = _int(last['is_abnormal']) == 1;
                return Card(child: ListTile(
                  title: Text(e.key.toString()),
                  subtitle: Text(rows.map((r) => _num(r['value']).toString()).join('  →  ')),
                  trailing: Text('${_num(last['value'])} ${last['unit'] ?? ''}', style: TextStyle(fontWeight: FontWeight.bold, color: abnormal ? Colors.red : null)),
                ));
              }),
              const SizedBox(height: 12),
              Text('Goals', style: Theme.of(context).textTheme.titleMedium),
              if (goals.isEmpty) const Padding(padding: EdgeInsets.all(16), child: Text('Set goals on the website Health Tracker.')),
              ...goals.map((g) => Card(child: ListTile(title: Text(g['label'].toString()),
                  subtitle: LinearProgressIndicator(value: (_num(g['progress']) / 100).clamp(0, 1).toDouble()),
                  trailing: Text(g['current'] == null ? '—' : _num(g['current']).toString())))),
              const Padding(padding: EdgeInsets.all(12), child: Text('For tracking only, not medical advice.', style: TextStyle(color: Colors.grey))),
            ]);
          },
        ),
      );
}

class _VitalDialog extends StatefulWidget {
  const _VitalDialog();
  @override
  State<_VitalDialog> createState() => _VitalDialogState();
}

class _VitalDialogState extends State<_VitalDialog> {
  String type = 'BP';
  final v1 = TextEditingController(), v2 = TextEditingController();
  static const types = {'BP': 'Blood pressure', 'SUGAR_FASTING': 'Sugar (fasting)', 'SUGAR_RANDOM': 'Sugar (random)', 'WEIGHT': 'Weight (kg)', 'PULSE': 'Pulse'};

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: const Text('Add a reading'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          DropdownButtonFormField<String>(value: type, items: types.entries.map((e) => DropdownMenuItem(value: e.key, child: Text(e.value))).toList(), onChanged: (v) => setState(() => type = v!)),
          TextField(controller: v1, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: InputDecoration(labelText: type == 'BP' ? 'Systolic' : 'Value')),
          if (type == 'BP') TextField(controller: v2, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Diastolic')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(onPressed: () async {
            try {
              await Api.post('vitals', {'type': type, 'value': double.tryParse(v1.text), if (type == 'BP') 'value2': double.tryParse(v2.text)});
              if (context.mounted) { Navigator.pop(context); _snack(context, 'Reading saved'); }
            } catch (e) {
              if (context.mounted) _snack(context, e.toString());
            }
          }, child: const Text('Save')),
        ],
      );
}

// ------------------------------------------------------------------ Wallet
class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key});
  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  Future<dynamic> data = Api.get('wallet');
  final code = TextEditingController();

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Wallet & refer')),
        body: FutureBuilder<dynamic>(
          future: data,
          builder: (c, s) {
            if (s.hasError) return Center(child: Text(s.error.toString()));
            if (!s.hasData) return const Center(child: CircularProgressIndicator());
            final d = s.data as Map;
            return ListView(padding: const EdgeInsets.all(16), children: [
              Text('Balance', style: Theme.of(context).textTheme.labelLarge),
              Text(_money(d['balance']), style: Theme.of(context).textTheme.displaySmall),
              const SizedBox(height: 12),
              Card(child: ListTile(title: Text('Your referral code: ${d['referral_code']}'),
                  subtitle: Text('When a friend books with your code, you both get ₹${d['referral_reward']}.'))),
              if (d['can_apply_referral'] == true) Row(children: [
                Expanded(child: TextField(controller: code, textCapitalization: TextCapitalization.characters, decoration: const InputDecoration(hintText: "Friend's code"))),
                TextButton(onPressed: () async {
                  try { await Api.post('wallet/referral', {'code': code.text}); setState(() => data = Api.get('wallet')); if (context.mounted) _snack(context, 'Referral code added'); }
                  catch (e) { if (context.mounted) _snack(context, e.toString()); }
                }, child: const Text('Apply')),
              ]),
              const Divider(),
              ...(d['transactions'] as List).map((t) => ListTile(dense: true, title: Text(t['reason'].toString()), subtitle: Text(t['created_at'].toString()),
                  trailing: Text('${_num(t['amount']) >= 0 ? '+' : '−'}${_money(_num(t['amount']).abs())}', style: TextStyle(color: _num(t['amount']) >= 0 ? Colors.teal : Colors.red)))),
            ]);
          },
        ),
      );
}

// ------------------------------------------------------------------ Test finder
class FinderScreen extends StatefulWidget {
  const FinderScreen({super.key});
  @override
  State<FinderScreen> createState() => _FinderScreenState();
}

class _FinderScreenState extends State<FinderScreen> {
  final q = TextEditingController();
  Map<String, dynamic>? res;
  bool busy = false;

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Which test do I need?')),
        body: ListView(padding: const EdgeInsets.all(16), children: [
          TextField(controller: q, maxLines: 3, decoration: const InputDecoration(hintText: 'e.g. I feel tired and my mother has thyroid')),
          const SizedBox(height: 8),
          FilledButton(onPressed: busy ? null : () async {
            setState(() => busy = true);
            try { final r = await Api.post('finder', {'query': q.text}); setState(() => res = Map<String, dynamic>.from(r)); }
            catch (e) { if (context.mounted) _snack(context, e.toString()); }
            finally { if (mounted) setState(() => busy = false); }
          }, child: const Text('Suggest tests')),
          if (res != null) ...[
            const SizedBox(height: 12),
            Text(res!['summary'].toString()),
            ...(res!['packages'] as List).map((p) => ListTile(leading: const Icon(Icons.inventory_2_outlined), title: Text(p['name'].toString()), subtitle: Text(p['why'].toString()), trailing: Text(_money(p['price'])))),
            ...(res!['tests'] as List).map((t) => ListTile(leading: const Icon(Icons.science_outlined), title: Text(t['name'].toString()), subtitle: Text(t['why'].toString()), trailing: Text(_money(t['price'])))),
            if ((res!['tests'] as List).isNotEmpty || (res!['packages'] as List).isNotEmpty)
              FilledButton(onPressed: () => Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => BookScreen(
                    preTests: (res!['tests'] as List).map((t) => _int(t['id'])).toSet(),
                    prePackages: (res!['packages'] as List).map((p) => _int(p['id'])).toSet()))), child: const Text('Book these')),
            const Padding(padding: EdgeInsets.only(top: 12), child: Text('Suggestions are not a diagnosis. For emergencies, get medical help right away.', style: TextStyle(color: Colors.grey))),
          ],
        ]),
      );
}

// ------------------------------------------------------------------ Family
class FamilyScreen extends StatefulWidget {
  const FamilyScreen({super.key});
  @override
  State<FamilyScreen> createState() => _FamilyScreenState();
}

class _FamilyScreenState extends State<FamilyScreen> {
  Future<dynamic> data = Api.get('family');

  Future<void> _add() async {
    final name = TextEditingController(), rel = TextEditingController();
    final ok = await showDialog<bool>(context: context, builder: (c) => AlertDialog(
          title: const Text('Add family member'),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(controller: name, decoration: const InputDecoration(labelText: 'Full name')),
            TextField(controller: rel, decoration: const InputDecoration(labelText: 'Relation (Mother, Son…)')),
          ]),
          actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')), FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Add'))],
        ));
    if (ok != true) return;
    try { await Api.post('family', {'full_name': name.text, 'relation': rel.text}); setState(() => data = Api.get('family')); }
    catch (e) { if (mounted) _snack(context, e.toString()); }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('My family')),
        floatingActionButton: FloatingActionButton(onPressed: _add, child: const Icon(Icons.person_add)),
        body: FutureBuilder<dynamic>(
          future: data,
          builder: (c, s) {
            if (s.hasError) return Center(child: Text(s.error.toString()));
            if (!s.hasData) return const Center(child: CircularProgressIndicator());
            final l = s.data as List;
            if (l.isEmpty) return const Center(child: Text('Add parents, spouse or children to book tests for them.'));
            return ListView(children: l.map((m) => ListTile(leading: const Icon(Icons.person_outline), title: Text(m['full_name'].toString()), subtitle: Text(m['relation'].toString()))).toList());
          },
        ),
      );
}
