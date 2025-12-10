from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from .models import Profile
from core.models import Player

@receiver(post_save, sender=Profile)
def sync_profile_to_players(sender, instance, **kwargs):
    user = instance.user
    qs = Player.objects.filter(userId=str(user.id))
    for p in qs:
        p.nickname = instance.nickname or p.nickname
        p.email = user.email or p.email
        p.avatar = instance.avatar or p.avatar
        p.phone = instance.phone or p.phone
        p.birthDate = instance.birthDate or p.birthDate
        p.favoriteTeam = instance.favoriteTeam or p.favoriteTeam
        p.position = instance.position or p.position
        p.save()

@receiver(post_save, sender=User)
def ensure_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.update_or_create(user=instance, defaults={
            'global_id': str(instance.id),
            'nickname': instance.username,
            'birthDate': '',
            'phone': '',
            'favoriteTeam': '',
            'position': '',
            'avatar': f"https://ui-avatars.com/api/?name={instance.get_full_name() or instance.username}&background=random"
        })
