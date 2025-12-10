from django.db import models


class Group(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    adminId = models.CharField(max_length=64)
    admins = models.JSONField(default=list, blank=True)
    name = models.CharField(max_length=200)
    sport = models.CharField(max_length=100)
    inviteCode = models.CharField(max_length=50)
    createdAt = models.CharField(max_length=50)
    members = models.JSONField(default=list, blank=True)
    pendingRequests = models.JSONField(default=list, blank=True)
    logo = models.TextField(null=True, blank=True)
    paymentMode = models.CharField(max_length=20, default='fixed')
    fixedAmount = models.FloatField(default=0)
    monthlyFee = models.FloatField(default=0)
    city = models.CharField(max_length=120, blank=True, default='')

    def __str__(self):
        return self.name


class Player(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    groupId = models.CharField(max_length=64)
    userId = models.CharField(max_length=64, null=True, blank=True)
    name = models.CharField(max_length=200)
    nickname = models.CharField(max_length=200)
    birthDate = models.CharField(max_length=20)
    email = models.EmailField()
    phone = models.CharField(max_length=50, unique=True)
    favoriteTeam = models.CharField(max_length=100)
    position = models.CharField(max_length=50)
    rating = models.FloatField()
    matchesPlayed = models.IntegerField()
    avatar = models.TextField(null=True, blank=True)
    isMonthlySubscriber = models.BooleanField(default=False)
    monthlyStartMonth = models.CharField(max_length=7, null=True, blank=True)
    isGuest = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.nickname} ({self.groupId})"


class Field(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    groupId = models.CharField(max_length=64)
    name = models.CharField(max_length=200)
    location = models.CharField(max_length=200)
    contactName = models.CharField(max_length=100, null=True, blank=True)
    contactPhone = models.CharField(max_length=50, null=True, blank=True)
    hourlyRate = models.FloatField()
    coordinates = models.JSONField(null=True, blank=True)

    def __str__(self):
        return self.name


class Match(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    groupId = models.CharField(max_length=64)
    date = models.CharField(max_length=20)
    time = models.CharField(max_length=10)
    fieldId = models.CharField(max_length=64)
    confirmedPlayerIds = models.JSONField(default=list, blank=True)
    paidPlayerIds = models.JSONField(default=list, blank=True)
    teamA = models.JSONField(default=list, blank=True)  # List of Player objects
    teamB = models.JSONField(default=list, blank=True)
    scoreA = models.IntegerField()
    scoreB = models.IntegerField()
    finished = models.BooleanField(default=False)
    mvpId = models.CharField(max_length=64, null=True, blank=True)

    def __str__(self):
        return f"{self.id} - {self.date}"


class Transaction(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    groupId = models.CharField(max_length=64)
    description = models.CharField(max_length=255)
    amount = models.FloatField()
    type = models.CharField(max_length=20)
    date = models.CharField(max_length=20)
    category = models.CharField(max_length=50)
    relatedPlayerId = models.CharField(max_length=64, null=True, blank=True)
    relatedMatchId = models.CharField(max_length=64, null=True, blank=True)

    def __str__(self):
        return f"{self.type} {self.amount}"


class Comment(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    groupId = models.CharField(max_length=64)
    matchId = models.CharField(max_length=64)
    parentId = models.CharField(max_length=64, null=True, blank=True)
    authorPlayerId = models.CharField(max_length=64)
    content = models.TextField()
    createdAt = models.CharField(max_length=25)

    def __str__(self):
        return f"{self.groupId}/{self.matchId} - {self.authorPlayerId}"
