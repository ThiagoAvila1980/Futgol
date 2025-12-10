from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.contrib.auth.tokens import default_token_generator
from .serializers import RegisterSerializer, UserSerializer
from .models import Profile
from core.models import Group, Player
from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken
from datetime import timedelta
from django.db.models import Q


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        data = UserSerializer.from_user(user)
        refresh = RefreshToken.for_user(user)
        access_ttl = request.data.get('access_ttl_minutes')
        refresh_ttl = request.data.get('refresh_ttl_days')
        if access_ttl:
            try:
                minutes = int(access_ttl)
                access = refresh.access_token
                access.set_exp(lifetime=timedelta(minutes=minutes))
            except Exception:
                pass
        if refresh_ttl:
            try:
                days = int(refresh_ttl)
                refresh.set_exp(lifetime=timedelta(days=days))
            except Exception:
                pass
        access_str = str(refresh.access_token)
        return Response({'user': data, 'access': access_str, 'refresh': str(refresh)}, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        user = authenticate(username=email, password=password)
        if not user:
            if getattr(settings, 'DEBUG', False) and email == 'thiago@teste.com' and password == '123456':
                if not User.objects.filter(username=email).exists():
                    user = User.objects.create_user(username=email, email=email, password=password, first_name='Thiago Admin')
                else:
                    user = User.objects.get(username=email)
                Profile.objects.update_or_create(
                    user=user,
                    defaults={
                        'global_id': '11999991111',
                        'nickname': 'Thiago',
                        'phone': '11999991111',
                        'favoriteTeam': 'São Paulo',
                        'position': 'MEIO',
                        'avatar': 'https://ui-avatars.com/api/?name=Thiago+Admin&background=random'
                    }
                )
            else:
                return Response({'detail': 'Credenciais inválidas'}, status=status.HTTP_400_BAD_REQUEST)
        data = UserSerializer.from_user(user)
        refresh = RefreshToken.for_user(user)
        access_ttl = request.data.get('access_ttl_minutes')
        refresh_ttl = request.data.get('refresh_ttl_days')
        if access_ttl:
            try:
                minutes = int(access_ttl)
                access = refresh.access_token
                access.set_exp(lifetime=timedelta(minutes=minutes))
            except Exception:
                pass
        if refresh_ttl:
            try:
                days = int(refresh_ttl)
                refresh.set_exp(lifetime=timedelta(days=days))
            except Exception:
                pass
        access_str = str(refresh.access_token)
        return Response({'user': data, 'access': access_str, 'refresh': str(refresh)}, status=status.HTTP_200_OK)


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        data = UserSerializer.from_user(request.user)
        return Response(data)


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response({'detail': 'Informe o email.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(username=email)
        except User.DoesNotExist:
            return Response({'detail': 'Se existir uma conta com este email, enviaremos instruções.'}, status=status.HTTP_200_OK)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        reset_link = request.build_absolute_uri(f"/reset-password?uid={uid}&token={token}")
        send_mail(
            subject='Recuperação de senha - Futgol',
            message=f'Use este link para redefinir sua senha: {reset_link}',
            from_email=None,
            recipient_list=[email],
            fail_silently=True,
        )
        payload = {'detail': 'Se existir uma conta com este email, enviaremos instruções.'}
        if getattr(settings, 'DEBUG', False):
            payload.update({'preview_link': reset_link, 'uid': uid, 'token': token})
        return Response(payload, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        uidb64 = request.data.get('uid')
        token = request.data.get('token')
        new_password = request.data.get('password')
        if not (uidb64 and token and new_password):
            return Response({'detail': 'Dados inválidos.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except Exception:
            return Response({'detail': 'Link inválido.'}, status=status.HTTP_400_BAD_REQUEST)
        if not default_token_generator.check_token(user, token):
            return Response({'detail': 'Token inválido ou expirado.'}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(new_password)
        user.save()
        return Response({'detail': 'Senha redefinida com sucesso.'}, status=status.HTTP_200_OK)


class HealthCheckView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({'status': 'ok'}, status=status.HTTP_200_OK)


class LookupByPhoneView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        raw = request.query_params.get('phone') or ''
        digits = ''.join([c for c in raw if c.isdigit()])
        if not digits:
            return Response({'detail': 'Informe o celular.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            p = Profile.objects.filter(Q(phone=digits) | Q(global_id=digits)).first()
        except Exception:
            p = None
        if p:
            # List groups where this user is a member
            user_id_str = str(p.user.id)
            groups = []
            for g in Group.objects.all():
                try:
                    members = g.members or []
                    if user_id_str in members:
                        groups.append({'id': g.id, 'name': g.name})
                except Exception:
                    continue
            data = {
                'found': True,
                'source': 'profile',
                'profile': {
                    'name': p.user.get_full_name() or p.user.username,
                    'email': p.user.email,
                    'nickname': p.nickname,
                    'birthDate': p.birthDate,
                    'phone': p.phone,
                    'favoriteTeam': p.favoriteTeam,
                    'position': p.position,
                },
                'groups': groups,
            }
            return Response(data, status=status.HTTP_200_OK)

        # fallback: search Player records (guest or member without account)
        players = list(Player.objects.filter(phone=digits))
        if not players:
            return Response({'found': False}, status=status.HTTP_200_OK)
        # Use the most recent or first player to prefill
        pl = players[0]
        group_ids = {pl.groupId for pl in players}
        groups = []
        for g in Group.objects.filter(id__in=list(group_ids)):
            groups.append({'id': g.id, 'name': g.name})
        data = {
            'found': True,
            'source': 'player',
            'profile': {
                'name': pl.name,
                'email': '',
                'nickname': pl.nickname,
                'birthDate': pl.birthDate,
                'phone': pl.phone,
                'favoriteTeam': pl.favoriteTeam,
                'position': pl.position,
            },
            'groups': groups,
        }
        return Response(data, status=status.HTTP_200_OK)
