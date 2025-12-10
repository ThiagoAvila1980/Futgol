from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Profile
from django.db.models import Q


class UserSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    email = serializers.EmailField()
    avatar = serializers.CharField(allow_blank=True, required=False)
    nickname = serializers.CharField(allow_blank=True, required=False)
    birthDate = serializers.CharField(allow_blank=True, required=False)
    phone = serializers.CharField(allow_blank=True, required=False)
    favoriteTeam = serializers.CharField(allow_blank=True, required=False)
    position = serializers.CharField(allow_blank=True, required=False)

    @staticmethod
    def from_user(u: User):
        p = getattr(u, 'profile', None)
        return {
            'id': p.global_id if p else str(u.id),
            'name': u.get_full_name() or u.username,
            'email': u.email,
            'avatar': p.avatar if p else '',
            'nickname': p.nickname if p else u.username,
            'birthDate': p.birthDate if p else '',
            'phone': p.phone if p else '',
            'favoriteTeam': p.favoriteTeam if p else '',
            'position': p.position if p else '',
        }


class RegisterSerializer(serializers.Serializer):
    name = serializers.CharField()
    email = serializers.EmailField()
    password = serializers.CharField()
    nickname = serializers.CharField(allow_blank=True, required=False)
    birthDate = serializers.CharField(allow_blank=True, required=False)
    phone = serializers.CharField()
    favoriteTeam = serializers.CharField(allow_blank=True, required=False)
    position = serializers.CharField(allow_blank=True, required=False)

    def validate_phone(self, value):
        digits = ''.join([c for c in value if c.isdigit()])
        if len(digits) < 10:
            raise serializers.ValidationError('Número de celular inválido.')
        if Profile.objects.filter(Q(global_id=digits) | Q(phone=digits)).exists():
            raise serializers.ValidationError('Celular já cadastrado. Faça login ou recupere a senha.')
        return digits

    def create(self, validated_data):
        name = validated_data.get('name')
        email = validated_data.get('email')
        password = validated_data.get('password')
        nickname = validated_data.get('nickname') or name.split(' ')[0]
        birthDate = validated_data.get('birthDate') or ''
        phone_digits = validated_data.get('phone')
        favoriteTeam = validated_data.get('favoriteTeam') or ''
        position = validated_data.get('position') or ''

        if User.objects.filter(username=email).exists():
            raise serializers.ValidationError('Email já cadastrado.')

        u = User.objects.create_user(username=email, email=email, password=password, first_name=name)
        Profile.objects.create(
            user=u,
            global_id=phone_digits,
            nickname=nickname,
            birthDate=birthDate,
            phone=phone_digits,
            favoriteTeam=favoriteTeam,
            position=position,
            avatar=f'https://ui-avatars.com/api/?name={name}&background=random'
        )
        return u
