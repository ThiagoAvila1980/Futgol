import 'package:flutter/material.dart';
import 'api_client.dart';
import 'pages/login_page.dart';
import 'pages/home_page.dart';

class SplashGate extends StatefulWidget {
  const SplashGate({super.key});

  @override
  State<SplashGate> createState() => _SplashGateState();
}

class _SplashGateState extends State<SplashGate> {
  bool _ready = false;
  bool _hasToken = false;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    await ApiClient().init();
    setState(() {
      _hasToken = ApiClient().hasToken;
      _ready = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!_ready) {
      return Scaffold(
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: const [
              CircularProgressIndicator(),
              SizedBox(height: 12),
              Text('Carregando...'),
            ],
          ),
        ),
      );
    }
    return _hasToken ? const HomePage() : const LoginPage();
  }
}
