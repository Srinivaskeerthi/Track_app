from django.apps import AppConfig

class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "core"

    def ready(self):
        # Run directly on server startup so it executes on the active web instance
        from core.models import Organization, User
        import os

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
                    print(f"Successfully bootstrapped admin '{username}' for organization '{org_name}' at startup.")
            except Exception as e:
                # If migrations haven't run yet, ignore table errors
                print(f"Admin bootstrap skipped or failed: {str(e)}")
