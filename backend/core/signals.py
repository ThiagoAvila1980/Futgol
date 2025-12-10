from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from .models import Group, Match, Transaction, Field, Player

@receiver(pre_save, sender=Group)
def ensure_group_invariants(sender, instance, **kwargs):
    admins = list(instance.admins or [])
    if instance.adminId and instance.adminId not in admins:
        admins.append(instance.adminId)
    instance.admins = list(dict.fromkeys(admins))
    members = list(instance.members or [])
    pending = [u for u in (instance.pendingRequests or []) if u not in members]
    instance.members = list(dict.fromkeys(members))
    instance.pendingRequests = list(dict.fromkeys(pending))

@receiver(post_save, sender=Match)
def upsert_match_transaction(sender, instance, **kwargs):
    try:
        field = Field.objects.get(pk=instance.fieldId)
    except Field.DoesNotExist:
        field = None

    if not instance.finished:
        return

    confirmed = list(instance.confirmedPlayerIds or [])
    paid = list(instance.paidPlayerIds or [])
    hourly = float(field.hourlyRate) if field else 0.0
    confirmed_count = len(confirmed)
    cost_per_person = hourly / confirmed_count if confirmed_count > 0 else 0.0

    players_paid = {p.id: p for p in Player.objects.filter(id__in=paid)}
    mensal_count = sum(1 for pid in paid if players_paid.get(pid) and players_paid[pid].isMonthlySubscriber)
    avulso_count = sum(1 for pid in paid if players_paid.get(pid) and not players_paid[pid].isMonthlySubscriber)

    mensal_amount = mensal_count * cost_per_person
    avulso_amount = avulso_count * cost_per_person

    # Remove transação agregada anterior (se existir)
    Transaction.objects.filter(relatedMatchId=instance.id, category='MATCH_REVENUE').delete()

    # Despesa: aluguel do campo
    tx_field_id = f"tx_field_{instance.id}"
    tx_field = Transaction.objects.filter(id=tx_field_id).first()
    if hourly > 0:
        if tx_field:
            tx_field.amount = hourly
            tx_field.description = f"Aluguel Campo - {field.name if field else ''}"
            tx_field.date = instance.date
            tx_field.save()
        else:
            Transaction.objects.create(
                id=tx_field_id,
                groupId=instance.groupId,
                relatedMatchId=instance.id,
                description=f"Aluguel Campo - {field.name if field else ''}",
                amount=hourly,
                type='EXPENSE',
                category='FIELD_RENT',
                date=instance.date,
            )
    else:
        if tx_field:
            tx_field.delete()

    # Receita: mensalistas
    tx_mensal_id = f"tx_mensal_{instance.id}"
    tx_mensal = Transaction.objects.filter(id=tx_mensal_id).first()
    if mensal_amount > 0:
        if tx_mensal:
            tx_mensal.amount = mensal_amount
            tx_mensal.description = f"Mensalistas - {instance.date}"
            tx_mensal.date = instance.date
            tx_mensal.save()
        else:
            Transaction.objects.create(
                id=tx_mensal_id,
                groupId=instance.groupId,
                relatedMatchId=instance.id,
                description=f"Mensalistas - {instance.date}",
                amount=mensal_amount,
                type='INCOME',
                category='MATCH_REVENUE_MENSAL',
                date=instance.date,
            )
    else:
        if tx_mensal:
            tx_mensal.delete()

    # Receita: avulsos
    tx_avulso_id = f"tx_avulso_{instance.id}"
    tx_avulso = Transaction.objects.filter(id=tx_avulso_id).first()
    if avulso_amount > 0:
        if tx_avulso:
            tx_avulso.amount = avulso_amount
            tx_avulso.description = f"Avulsos - {instance.date}"
            tx_avulso.date = instance.date
            tx_avulso.save()
        else:
            Transaction.objects.create(
                id=tx_avulso_id,
                groupId=instance.groupId,
                relatedMatchId=instance.id,
                description=f"Avulsos - {instance.date}",
                amount=avulso_amount,
                type='INCOME',
                category='MATCH_REVENUE_AVULSO',
                date=instance.date,
            )
    else:
        if tx_avulso:
            tx_avulso.delete()
