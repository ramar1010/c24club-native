export interface DiscoverMember {
  id: string;
  name: string;
  bio: string | null;
  gender: string | null;
  image_url: string | null;
  image_thumb_url: string | null;
  image_status: string | null;
  is_discoverable: boolean;
  last_active_at: string | null;
  country: string | null;
  created_at: string;
  membership: string | null;
  is_test_account: boolean;
  role: string | null;
}