from django.db import models
from django.contrib.auth.models import User


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    global_id = models.CharField(max_length=32, unique=True)
    nickname = models.CharField(max_length=200, blank=True)
    birthDate = models.CharField(max_length=20, blank=True)
    phone = models.CharField(max_length=50, blank=True)
    favoriteTeam = models.CharField(max_length=100, blank=True)
    position = models.CharField(max_length=50, blank=True)
    avatar = models.TextField(blank=True)

    def __str__(self):
        return f"{self.user.username} ({self.global_id})"
