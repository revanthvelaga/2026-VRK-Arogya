import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

/// flutter build apk --dart-define=API_BASE=https://your-domain.com/api
const String apiBase = String.fromEnvironment('API_BASE', defaultValue: 'http://10.0.2.2:8080/api');

String? token;

class ApiException implements Exception {
  final String message;
  ApiException(this.message);
  @override
  String toString() => message;
}

Future<dynamic> call(String method, String path, [Map<String, dynamic>? body]) async {
  final uri = Uri.parse('$apiBase/$path');
  final headers = {'Content-Type': 'application/json', if (token != null) 'Authorization': 'Bearer $token'};
  try {
    final r = method == 'GET'
        ? await http.get(uri, headers: headers).timeout(const Duration(seconds: 20))
        : await http.post(uri, headers: headers, body: jsonEncode(body ?? {})).timeout(const Duration(seconds: 20));
    final j = jsonDecode(r.body);
    if (r.statusCode >= 400) throw ApiException(j is Map && j['error'] != null ? j['error'].toString() : 'Request failed');
    return j;
  } on SocketException {
    throw ApiException('No internet connection');
  } on FormatException {
    throw ApiException('Unexpected server response');
  }
}

void snack(BuildContext c, String m) => ScaffoldMessenger.of(c).showSnackBar(SnackBar(content: Text(m)));

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  token = (await SharedPreferences.getInstance()).getString('token');
  runApp(const TechnicianApp());
}

class TechnicianApp extends StatelessWidget {
  const TechnicianApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Technician',
        theme: ThemeData(colorSchemeSeed: const Color(0xFF0B6E4F), useMaterial3: true),
        home: token != null ? const JobsScreen() : const LoginScreen(),
      );
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final id = TextEditingController(), pw = TextEditingController();
  bool busy = false;

  Future<void> login() async {
    setState(() => busy = true);
    try {
      final r = await call('POST', 'auth/login', {'identifier': id.text.trim(), 'password': pw.text});
      if (r['user']['role'] != 'TECHNICIAN') throw ApiException('This app is for technicians only');
      token = r['token'];
      await (await SharedPreferences.getInstance()).setString('token', token!);
      if (mounted) Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const JobsScreen()));
    } catch (e) {
      if (mounted) snack(context, e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Technician Login')),
        body: ListView(padding: const EdgeInsets.all(16), children: [
          TextField(controller: id, decoration: const InputDecoration(labelText: 'Phone or email')),
          TextField(controller: pw, obscureText: true, decoration: const InputDecoration(labelText: 'Password')),
          const SizedBox(height: 16),
          FilledButton(onPressed: busy ? null : login, child: const Text('Login')),
        ]),
      );
}

class JobsScreen extends StatefulWidget {
  const JobsScreen({super.key});
  @override
  State<JobsScreen> createState() => _JobsScreenState();
}

class _JobsScreenState extends State<JobsScreen> {
  List<dynamic> jobs = [];
  bool loading = true;
  Timer? poll;

  @override
  void initState() {
    super.initState();
    load();
    poll = Timer.periodic(const Duration(seconds: 30), (_) => load(silent: true)); // keep in sync with backend
  }

  @override
  void dispose() {
    poll?.cancel();
    super.dispose();
  }

  Future<void> load({bool silent = false}) async {
    try {
      final r = await call('GET', 'tech/jobs');
      if (mounted) setState(() => jobs = r);
    } catch (e) {
      if (mounted && !silent) snack(context, e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> update(dynamic job, String status) async {
    try {
      await call('POST', 'tech/jobs/${job['id']}/status', {'status': status});
      load();
    } catch (e) {
      if (mounted) snack(context, e.toString());
    }
  }

  Future<void> navigate(dynamic j) async {
    final lat = j['latitude'], lng = j['longitude'];
    final q = lat != null && lng != null ? '$lat,$lng' : Uri.encodeComponent(j['address'].toString());
    await launchUrl(Uri.parse('https://www.google.com/maps/search/?api=1&query=$q'), mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('My Jobs'), actions: [
          IconButton(
              icon: const Icon(Icons.logout),
              onPressed: () async {
                try {
                  await call('POST', 'auth/logout');
                } catch (_) {}
                token = null;
                await (await SharedPreferences.getInstance()).remove('token');
                if (context.mounted) Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const LoginScreen()));
              }),
        ]),
        body: loading
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: load,
                child: ListView(padding: const EdgeInsets.all(12), children: [
                  if (jobs.isEmpty) const Padding(padding: EdgeInsets.all(32), child: Center(child: Text('No assigned jobs.'))),
                  ...jobs.map((j) {
                    final next = {'ASSIGNED': 'ON_WAY', 'ON_WAY': 'SAMPLE_COLLECTED'}[j['status']];
                    return Card(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('#${j['id']} — ${j['patient_name']}', style: Theme.of(context).textTheme.titleMedium),
                          Text('${j['scheduled_at']}\n${j['address']}'),
                          Text('Status: ${j['status']}'),
                          Row(children: [
                            TextButton.icon(icon: const Icon(Icons.call), label: Text(j['patient_phone']), onPressed: () => launchUrl(Uri.parse('tel:${j['patient_phone']}'))),
                            TextButton.icon(icon: const Icon(Icons.navigation), label: const Text('Navigate'), onPressed: () => navigate(j)),
                          ]),
                          if (next != null) FilledButton(onPressed: () => update(j, next), child: Text(next == 'ON_WAY' ? 'Mark On Way' : 'Mark Sample Collected')),
                        ]),
                      ),
                    );
                  }),
                ]),
              ),
      );
}
