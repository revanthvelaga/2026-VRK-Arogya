import 'dart:async';
import 'package:flutter/material.dart';
import 'package:open_filex/open_filex.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import 'api.dart';

const statusLabels = {
  'BOOKED': 'Booked',
  'ASSIGNED': 'Technician Assigned',
  'ON_WAY': 'Technician On Way',
  'SAMPLE_COLLECTED': 'Sample Collected',
  'REPORT_READY': 'Report Ready',
  'CANCELLED': 'Cancelled',
};

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Api.loadToken();
  runApp(const PatientApp());
}

void snack(BuildContext c, String m) => ScaffoldMessenger.of(c).showSnackBar(SnackBar(content: Text(m)));

class PatientApp extends StatelessWidget {
  const PatientApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Diagnostics',
        theme: ThemeData(colorSchemeSeed: const Color(0xFF0B6E4F), useMaterial3: true),
        home: Api.loggedIn ? const HomeScreen() : const LoginScreen(),
      );
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final id = TextEditingController(), pw = TextEditingController(), name = TextEditingController(), email = TextEditingController();
  bool register = false, busy = false;

  Future<void> submit() async {
    setState(() => busy = true);
    try {
      if (register) {
        await Api.register(name.text.trim(), id.text.trim(), email.text.trim(), pw.text);
      } else {
        await Api.login(id.text.trim(), pw.text);
      }
      if (!mounted) return;
      Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const HomeScreen()));
    } catch (e) {
      if (mounted) snack(context, e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text(register ? 'Register' : 'Login')),
        body: ListView(padding: const EdgeInsets.all(16), children: [
          if (register) TextField(controller: name, decoration: const InputDecoration(labelText: 'Full name')),
          TextField(controller: id, keyboardType: TextInputType.phone, decoration: InputDecoration(labelText: register ? 'Phone' : 'Phone or email')),
          if (register) TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email (optional)')),
          TextField(controller: pw, obscureText: true, decoration: const InputDecoration(labelText: 'Password')),
          const SizedBox(height: 16),
          FilledButton(onPressed: busy ? null : submit, child: Text(register ? 'Create account' : 'Login')),
          TextButton(onPressed: () => setState(() => register = !register), child: Text(register ? 'Have an account? Login' : 'New patient? Register')),
        ]),
      );
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<dynamic> appts = [];
  bool loading = true;
  Timer? poll;

  @override
  void initState() {
    super.initState();
    load();
    poll = Timer.periodic(const Duration(seconds: 30), (_) => load(silent: true)); // live status refresh
  }

  @override
  void dispose() {
    poll?.cancel();
    super.dispose();
  }

  Future<void> load({bool silent = false}) async {
    try {
      final r = await Api.get('appointments');
      if (mounted) setState(() => appts = r);
    } catch (e) {
      if (mounted && !silent) snack(context, e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('My Appointments'), actions: [
          IconButton(
              icon: const Icon(Icons.notifications),
              onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const NotificationsScreen()))),
          IconButton(
              icon: const Icon(Icons.logout),
              onPressed: () async {
                await Api.logout();
                if (context.mounted) Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const LoginScreen()));
              }),
        ]),
        floatingActionButton: FloatingActionButton.extended(
          icon: const Icon(Icons.add),
          label: const Text('Book test'),
          onPressed: () async {
            await Navigator.push(context, MaterialPageRoute(builder: (_) => const BookScreen()));
            load();
          },
        ),
        body: loading
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: load,
                child: appts.isEmpty
                    ? ListView(children: const [Padding(padding: EdgeInsets.all(32), child: Center(child: Text('No appointments yet.')))])
                    : ListView(
                        children: appts
                            .map((a) => ListTile(
                                  title: Text('#${a['id']} — ${a['scheduled_at']}'),
                                  subtitle: Text('${statusLabels[a['status']] ?? a['status']} · ₹${a['total_amount']} · ${a['payment_status']}'),
                                  trailing: const Icon(Icons.chevron_right),
                                  onTap: () async {
                                    await Navigator.push(context, MaterialPageRoute(builder: (_) => DetailScreen(id: int.parse(a['id'].toString()))));
                                    load();
                                  },
                                ))
                            .toList()),
              ),
      );
}

class BookScreen extends StatefulWidget {
  const BookScreen({super.key});
  @override
  State<BookScreen> createState() => _BookScreenState();
}

class _BookScreenState extends State<BookScreen> {
  List<dynamic> tests = [];
  final selected = <int>{};
  final address = TextEditingController();
  DateTime? date;
  TimeOfDay? time;
  bool busy = false;

  @override
  void initState() {
    super.initState();
    Api.get('tests').then((r) => mounted ? setState(() => tests = r) : null).catchError((e) {
      if (mounted) snack(context, e.toString());
    });
  }

  double get total => tests.where((t) => selected.contains(int.parse(t['id'].toString()))).fold(0.0, (s, t) => s + double.parse(t['price'].toString()));

  String two(int n) => n.toString().padLeft(2, '0');

  Future<void> book() async {
    if (selected.isEmpty || date == null || time == null || address.text.trim().isEmpty) {
      snack(context, 'Select tests, date, time and address');
      return;
    }
    setState(() => busy = true);
    try {
      final when = '${date!.year}-${two(date!.month)}-${two(date!.day)} ${two(time!.hour)}:${two(time!.minute)}';
      await Api.post('appointments', {'test_ids': selected.toList(), 'scheduled_at': when, 'address': address.text.trim()});
      if (!mounted) return;
      snack(context, 'Appointment booked');
      Navigator.pop(context);
    } catch (e) {
      if (mounted) snack(context, e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Book appointment')),
        body: ListView(padding: const EdgeInsets.all(16), children: [
          ...tests.map((t) {
            final tid = int.parse(t['id'].toString());
            return CheckboxListTile(
              value: selected.contains(tid),
              title: Text(t['name']),
              subtitle: Text('₹${t['price']}'),
              onChanged: (v) => setState(() => v == true ? selected.add(tid) : selected.remove(tid)),
            );
          }),
          ListTile(
              title: Text(date == null ? 'Pick date' : '${date!.day}/${date!.month}/${date!.year}'),
              leading: const Icon(Icons.calendar_today),
              onTap: () async {
                final d = await showDatePicker(context: context, initialDate: DateTime.now().add(const Duration(days: 1)), firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 90)));
                if (d != null) setState(() => date = d);
              }),
          ListTile(
              title: Text(time == null ? 'Pick time' : time!.format(context)),
              leading: const Icon(Icons.access_time),
              onTap: () async {
                final t = await showTimePicker(context: context, initialTime: const TimeOfDay(hour: 9, minute: 0));
                if (t != null) setState(() => time = t);
              }),
          TextField(controller: address, maxLines: 3, decoration: const InputDecoration(labelText: 'Collection address')),
          const SizedBox(height: 12),
          Text('Total: ₹${total.toStringAsFixed(2)}', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          FilledButton(onPressed: busy ? null : book, child: const Text('Confirm booking')),
        ]),
      );
}

class DetailScreen extends StatefulWidget {
  final int id;
  const DetailScreen({super.key, required this.id});
  @override
  State<DetailScreen> createState() => _DetailScreenState();
}

class _DetailScreenState extends State<DetailScreen> {
  Map<String, dynamic>? a;
  Timer? poll;
  late final Razorpay rzp;

  @override
  void initState() {
    super.initState();
    rzp = Razorpay();
    rzp.on(Razorpay.EVENT_PAYMENT_SUCCESS, onPaid);
    rzp.on(Razorpay.EVENT_PAYMENT_ERROR, (PaymentFailureResponse r) => snack(context, 'Payment failed'));
    load();
    poll = Timer.periodic(const Duration(seconds: 20), (_) => load(silent: true));
  }

  @override
  void dispose() {
    poll?.cancel();
    rzp.clear();
    super.dispose();
  }

  Future<void> load({bool silent = false}) async {
    try {
      final r = await Api.get('appointments/${widget.id}');
      if (mounted) setState(() => a = Map<String, dynamic>.from(r));
    } catch (e) {
      if (mounted && !silent) snack(context, e.toString());
    }
  }

  Future<void> onPaid(PaymentSuccessResponse r) async {
    try {
      await Api.post('payments/verify', {'razorpay_order_id': r.orderId, 'razorpay_payment_id': r.paymentId, 'razorpay_signature': r.signature});
      if (mounted) snack(context, 'Payment successful');
      load();
    } catch (e) {
      if (mounted) snack(context, e.toString());
    }
  }

  Future<void> pay() async {
    try {
      final o = await Api.post('payments/order', {'appointment_id': widget.id});
      rzp.open({'key': o['key_id'], 'order_id': o['order_id'], 'amount': o['amount'], 'name': 'Diagnostics', 'description': 'Appointment #${widget.id}'});
    } catch (e) {
      if (mounted) snack(context, e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = a;
    return Scaffold(
      appBar: AppBar(title: Text('Appointment #${widget.id}')),
      body: d == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(padding: const EdgeInsets.all(16), children: [
              Text(statusLabels[d['status']] ?? d['status'], style: Theme.of(context).textTheme.headlineSmall),
              Text('${d['scheduled_at']}\n${d['address']}'),
              if (d['technician_name'] != null) Text('Technician: ${d['technician_name']} (${d['technician_phone']})'),
              const Divider(),
              ...(d['items'] as List).map((i) => ListTile(dense: true, title: Text(i['name']), trailing: Text('₹${i['price']}'))),
              ListTile(title: const Text('Total'), trailing: Text('₹${d['total_amount']}')),
              Text('Payment: ${d['payment_status']}'),
              if (d['payment_status'] == 'PENDING' && d['status'] != 'CANCELLED') FilledButton(onPressed: pay, child: const Text('Pay online')),
              const Divider(),
              Text('Timeline', style: Theme.of(context).textTheme.titleMedium),
              ...(d['timeline'] as List).map((t) => ListTile(dense: true, leading: const Icon(Icons.check_circle_outline), title: Text(statusLabels[t['status']] ?? t['status']), subtitle: Text(t['changed_at']))),
              const Divider(),
              Text('Reports', style: Theme.of(context).textTheme.titleMedium),
              if ((d['reports'] as List).isEmpty) const Text('Report will appear here when ready.'),
              ...(d['reports'] as List).map((r) => ListTile(
                    leading: const Icon(Icons.picture_as_pdf),
                    title: Text(r['original_name']),
                    onTap: () async {
                      try {
                        final path = await Api.downloadReport(int.parse(r['id'].toString()), r['original_name']);
                        await OpenFilex.open(path);
                      } catch (e) {
                        if (context.mounted) snack(context, e.toString());
                      }
                    },
                  )),
              if (d['status'] == 'BOOKED' || d['status'] == 'ASSIGNED')
                TextButton(
                    onPressed: () async {
                      try {
                        await Api.post('appointments/${widget.id}/cancel');
                        load();
                      } catch (e) {
                        if (context.mounted) snack(context, e.toString());
                      }
                    },
                    child: const Text('Cancel appointment')),
            ]),
    );
  }
}

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Notifications')),
        body: FutureBuilder<dynamic>(
          future: Api.get('notifications'),
          builder: (c, s) {
            if (s.hasError) return Center(child: Text(s.error.toString()));
            if (!s.hasData) return const Center(child: CircularProgressIndicator());
            final l = s.data as List;
            return ListView(children: l.map((n) => ListTile(title: Text(n['title']), subtitle: Text('${n['body']}\n${n['created_at']}'))).toList());
          },
        ),
      );
}
