import 'package:flutter/material.dart';
import 'pages/login_page.dart';
import 'pages/home_page.dart';
import 'api_client.dart';
import 'splash_gate.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

void main() {
  runApp(const FutgolApp());
}

class FutgolApp extends StatelessWidget {
  const FutgolApp({super.key});

  ThemeData _theme() {
    const amarelo = Color(0xFFFFC107);
    const preto = Color(0xFF000000);
    const cinza = Color(0xFF9E9E9E);
    const branco = Color(0xFFFFFFFF);
    return ThemeData(
      colorScheme: ColorScheme(
        brightness: Brightness.light,
        primary: amarelo,
        onPrimary: preto,
        secondary: cinza,
        onSecondary: branco,
        error: Colors.red,
        onError: branco,
        surface: branco,
        onSurface: preto,
      ),
      appBarTheme:
          const AppBarTheme(backgroundColor: preto, foregroundColor: branco),
      scaffoldBackgroundColor: branco,
      useMaterial3: true,
    );
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'FutGol',
      theme: _theme(),
      locale: const Locale('pt', 'BR'),
      supportedLocales: const [Locale('pt', 'BR')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: kIsWeb ? const LoginPage() : const SplashGate(),
      routes: {
        '/login': (_) => const LoginPage(),
        '/home': (_) => const HomePage(),
      },
    );
  }
}
