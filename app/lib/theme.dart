// theme.dart
import 'package:flutter/material.dart';

final Color amarelo = Color(0xFFFFC107);
final Color preto = Color(0xFF000000);
final Color cinza = Color(0xFF9E9E9E);
final Color branco = Color(0xFFFFFFFF);

ThemeData futgolTheme = ThemeData(
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
  appBarTheme: AppBarTheme(backgroundColor: preto, foregroundColor: branco),
  scaffoldBackgroundColor: branco,
  useMaterial3: true,
);