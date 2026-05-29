from django.apps import AppConfig
from django.db.models.signals import post_migrate

def bootstrap_production_admin(sender, **kwargs):
    from core.models import Organization, User
    import os

    # Read configuration from environment variables
    org_name = os.environ.get('ADMIN_ORG')
    username = os.environ.get('ADMIN_USER')
    email = os.environ.get('ADMIN_EMAIL')
    password = os.environ.get('ADMIN_PASSWORD')

    if all([org_name, username, email, password]):
        try:
            slug = org_name.lower().replace(' ', '-')
            org, _ = Organization.objects.get_or_create(
                slug=slug,
                defaults={'name': org_name}
            )

            if not User.objects.filter(username=username).exists():
                user = User.objects.create(
                    username=username,
                    email=email,
                    role=User.ROLE_ADMIN,
                    organization=org,
                    is_staff=True,
                    is_superuser=True,
                )
                user.set_password(password)
                user.save()
                print(f"Successfully bootstrapped admin '{username}' for organization '{org_name}'.")
        except Exception as e:
            print(f"Admin bootstrap skipped or failed: {str(e)}")

class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "core"

    def ready(self):
        post_migrate.connect(bootstrap_production_admin, sender=self)
