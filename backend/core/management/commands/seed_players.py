from django.core.management.base import BaseCommand
from core.models import Group, Player
import random


NAMES = [
    'Ronaldinho', 'Ronaldo Fenômeno', 'Cafu', 'Roberto Carlos', 'Kaká', 'Neymar Jr',
    'Alisson Becker', 'Thiago Silva', 'Casemiro', 'Vinicius Jr', 'Marquinhos', 'Dida',
    'Rivaldo', 'Romário', 'Bebeto', 'Taffarel', 'Zico', 'Sócrates', 'Pelé', 'Garrincha',
    'Rivaldinho', 'Anderson', 'João Pedro', 'Lucas Moura', 'Gabriel Jesus', 'Everton',
    'Arthur', 'Gerson', 'Bruno Henrique', 'Arrascaeta', 'Paquetá', 'Fred', 'Hulk',
    'Diego Souza', 'Danilo', 'Alex', 'Juninho', 'Ricardinho', 'Luís Fabiano', 'Edmundo'
]

POSITIONS = ['Goleiro', 'Defensor', 'Meio-Campo', 'Atacante']


class Command(BaseCommand):
    help = 'Gera jogadores fictícios para um grupo'

    def add_arguments(self, parser):
        parser.add_argument('--group', help='ID do grupo alvo')
        parser.add_argument('--count', type=int, default=30, help='Quantidade de jogadores a criar')

    def handle(self, *args, **opts):
        group_id = opts.get('group')
        count = int(opts.get('count') or 30)

        group = None
        if group_id:
            try:
                group = Group.objects.get(pk=group_id)
            except Group.DoesNotExist:
                self.stderr.write(self.style.ERROR(f"Grupo '{group_id}' não encontrado"))
                return
        else:
            group = Group.objects.order_by('id').first()
            if not group:
                group = Group.objects.create(
                    id='group_demo_01',
                    adminId='user_123',
                    admins=['user_123'],
                    name='Pelada dos Amigos ⚽',
                    sport='Futebol Society',
                    inviteCode='GOL-10',
                    createdAt='2025-01-01T00:00:00Z',
                    members=['user_123'],
                    pendingRequests=[],
                )

        created = 0
        for i in range(count):
            base_name = NAMES[i % len(NAMES)]
            suffix = f"_{i+1}"
            pid = f"player_seed{suffix}"

            if Player.objects.filter(id=pid, groupId=group.id).exists():
                continue

            name = base_name
            nickname = base_name.split(' ')[0]
            email = f"{nickname.lower()}{i+1}@teste.com"
            position = random.choice(POSITIONS)
            rating = random.choice([3, 4, 5])
            matches_played = random.randint(0, 20)
            is_monthly = i < max(5, count // 3)
            is_guest = i % 10 == 0

            # Generate unique 11-digit phone: 99900000000 + i
            phone_digits = f"999{str(10000000 + i).zfill(8)}"[:11]

            Player.objects.create(
                id=pid,
                groupId=group.id,
                name=name,
                nickname=nickname,
                birthDate='1990-01-01',
                email=email,
                phone=phone_digits,
                userId=phone_digits,
                favoriteTeam='Brasil',
                position=position,
                rating=rating,
                matchesPlayed=matches_played,
                avatar=f"https://ui-avatars.com/api/?name={nickname}&background=random&size=128",
                isMonthlySubscriber=is_monthly,
                isGuest=is_guest,
            )
            created += 1

        self.stdout.write(self.style.SUCCESS(f"Criados {created} jogadores no grupo '{group.id}'"))
