-- Fix: on_auth_user_created trigger should only fire for restaurant users
-- Previously it fired for both 'restaurant' and 'supplier', which caused
-- phantom restaurant rows when onboarding suppliers.

-- Step 1: Drop the old trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Step 2: Recreate handle_new_user with explicit restaurant-only guard
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Only handle restaurant users — suppliers are handled by handle_new_supplier_user()
  IF NEW.raw_user_meta_data->>'user_type' = 'restaurant' THEN
    -- Create restaurants record
    INSERT INTO public.restaurants (id, name, contact_email, tenant_id)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', 'Ny restaurang'),
      NEW.email,
      COALESCE((NEW.raw_user_meta_data->>'tenant_id')::UUID, '00000000-0000-0000-0000-000000000001'::UUID)
    );

    -- Create restaurant_users junction record
    INSERT INTO public.restaurant_users (id, restaurant_id, role)
    VALUES (
      NEW.id,
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'role', 'admin')
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 3: Recreate trigger — ONLY for restaurant users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.raw_user_meta_data->>'user_type' = 'restaurant')
  EXECUTE FUNCTION public.handle_new_user();
