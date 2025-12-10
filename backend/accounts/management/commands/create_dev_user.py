from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from accounts.models import Profile


class Command(BaseCommand):
    help = "Cria/atualiza um usuário de desenvolvimento com Profile"

    def add_arguments(self, parser):
        parser.add_argument('--email', required=True)
        parser.add_argument('--password', required=True)
        parser.add_argument('--name', default='Dev User')
        parser.add_argument('--phone', default='00000000000')
        parser.add_argument('--nickname', default='Dev')
        parser.add_argument('--birthDate', default='')
        parser.add_argument('--favoriteTeam', default='')
        parser.add_argument('--position', default='MEIO')

    def handle(self, *args, **opts):
        email = opts['email']
        password = opts['password']
        name = opts['name']
        phone = ''.join([c for c in opts['phone'] if c.isdigit()])
        nickname = opts['nickname']
        birthDate = opts['birthDate']
        favoriteTeam = opts['favoriteTeam']
        position = opts['position']

        user, created = User.objects.get_or_create(username=email, defaults={'email': email, 'first_name': name})
        user.set_password(password)
        user.save()

        profile, p_created = Profile.objects.get_or_create(user=user, defaults={
            'global_id': phone or '00000000000',
            'nickname': nickname,
            'birthDate': birthDate,
            'phone': phone or '00000000000',
            'favoriteTeam': favoriteTeam,
            'position': position,
            'avatar': f'https://ui-avatars.com/api/?name={name}&background=random'
        })

        if not p_created:
            profile.global_id = phone or profile.global_id
            profile.nickname = nickname or profile.nickname
            profile.birthDate = birthDate or profile.birthDate
            profile.phone = phone or profile.phone
            profile.favoriteTeam = favoriteTeam or profile.favoriteTeam
            profile.position = position or profile.position
            profile.save()

        self.stdout.write(self.style.SUCCESS(f"Usuário '{email}' pronto (id={user.id})"))
