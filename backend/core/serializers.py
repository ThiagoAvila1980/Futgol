from rest_framework import serializers
from .models import Group, Player, Field, Match, Transaction, Comment


class GroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = '__all__'


class PlayerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Player
        fields = '__all__'

    def validate_phone(self, value):
        digits = ''.join([c for c in (value or '') if c.isdigit()])
        if not digits or len(digits) < 10:
            raise serializers.ValidationError('Informe um celular válido (somente números).')
        # Check uniqueness excluding current instance
        qs = Player.objects.filter(phone=digits)
        instance = getattr(self, 'instance', None)
        if instance is not None:
            qs = qs.exclude(pk=instance.pk)
        if qs.exists():
            raise serializers.ValidationError('Este celular já está cadastrado.')
        return digits

    def create(self, validated_data):
        # Ensure phone stored as digits only
        digits = self.validate_phone(validated_data.get('phone', ''))
        validated_data['phone'] = digits
        validated_data['userId'] = digits
        if validated_data.get('isGuest'):
            validated_data['isMonthlySubscriber'] = False
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if 'phone' in validated_data:
            digits = self.validate_phone(validated_data.get('phone', ''))
            validated_data['phone'] = digits
            validated_data['userId'] = digits
        if validated_data.get('isGuest'):
            validated_data['isMonthlySubscriber'] = False
        return super().update(instance, validated_data)


class FieldSerializer(serializers.ModelSerializer):
    class Meta:
        model = Field
        fields = '__all__'


class MatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Match
        fields = '__all__'


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = '__all__'


class CommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comment
        fields = '__all__'
