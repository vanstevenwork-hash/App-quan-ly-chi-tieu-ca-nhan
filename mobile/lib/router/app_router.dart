import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../state/auth_provider.dart';
import '../features/splash_screen.dart';
import '../features/auth/login_screen.dart';
import '../features/auth/register_screen.dart';
import '../features/dashboard/dashboard_screen.dart';
import '../features/calendar/calendar_screen.dart';
import '../features/accounts/accounts_screen.dart';
import '../features/goals/goals_screen.dart';
import '../features/settings/settings_screen.dart';
import '../features/notifications/notifications_screen.dart';
import '../features/analytics/analytics_screen.dart';
import '../features/cards/card_detail_screen.dart';
import '../widgets/app_scaffold.dart';

/// go_router wired to the auth state (mirrors the web AuthGuard). While the
/// session is still resolving we sit on the splash; unauthenticated users are
/// bounced to /auth/login; authenticated users land on /dashboard.
// Dev-only landing override (via --dart-define=LANDING=/accounts) so screens can
// be captured without tapping the bottom nav. Defaults to /dashboard.
const _landing = String.fromEnvironment('LANDING', defaultValue: '/dashboard');

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = ValueNotifier<int>(0);
  ref.listen(authProvider, (_, _) => refresh.value++);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: '/',
    refreshListenable: refresh,
    redirect: (context, state) {
      final status = ref.read(authProvider).status;
      final loc = state.matchedLocation;
      final onAuth = loc.startsWith('/auth');
      final onSplash = loc == '/';
      if (status == AuthStatus.unknown) return onSplash ? null : '/';
      if (status == AuthStatus.unauthenticated) return onAuth ? null : '/auth/login';
      if (onAuth || onSplash) return _landing;
      return null;
    },
    routes: [
      GoRoute(path: '/', builder: (_, _) => const SplashScreen()),
      GoRoute(path: '/auth/login', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/auth/register', builder: (_, _) => const RegisterScreen()),
      // Full-screen routes pushed over the tab shell.
      GoRoute(path: '/notifications', builder: (_, _) => const NotificationsScreen()),
      GoRoute(path: '/analytics', builder: (_, _) => const AnalyticsScreen()),
      GoRoute(
        path: '/cards/:id',
        builder: (_, state) => CardDetailScreen(cardId: state.pathParameters['id']!),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => AppScaffold(shell: shell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(path: '/dashboard', builder: (_, _) => const DashboardScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/calendar', builder: (_, _) => const CalendarScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/accounts', builder: (_, _) => const AccountsScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/goals', builder: (_, _) => const GoalsScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/settings', builder: (_, _) => const SettingsScreen()),
          ]),
        ],
      ),
    ],
  );
});
