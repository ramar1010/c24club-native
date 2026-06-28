import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export function useChatBlur(partnerId: string | null | undefined, callState: string) {
  const [isBlurred, setIsBlurred] = useState(false);
  const [userManuallyUnblurred, setUserManuallyUnblurred] = useState(false);
  const [isNsfwFlagged, setIsNsfwFlagged] = useState(false);
  const stickyBlurRef = useRef(false); // Carries over strike-based blur
  const sessionUnblurredRef = useRef(false);

  // Reset session unblurred when screen unmounts or explicitly reset
  useEffect(() => {
    return () => {
      sessionUnblurredRef.current = false;
    };
  }, []);

  useEffect(() => {
    // If we disconnect or change partner, reset the live flagged state
    if (callState !== 'connected') {
      setIsBlurred(false);
      setIsNsfwFlagged(false);
      return;
    }

    if (!partnerId) {
      setIsBlurred(false);
      return;
    }

    // If user already unblurred for this session, don't blur again
    if (sessionUnblurredRef.current) {
      setIsBlurred(false);
      return;
    }

    const checkStrikes = async () => {
      try {
        const { data: strikes, error } = await supabase.rpc('get_partner_nsfw_strikes', {
          _user_id: partnerId
        });

        if (error) {
          console.error('[useChatBlur] Error fetching strikes:', error);
          return;
        }

        if (strikes > 0) {
          console.log(`[useChatBlur] Partner ${partnerId} has strikes. Applying blur.`);
          stickyBlurRef.current = true;
          setIsBlurred(true);
        } else if (stickyBlurRef.current || isNsfwFlagged) {
          // Latch if previously blurred due to strikes OR if flagged in this session
          setIsBlurred(true);
        } else {
          setIsBlurred(false);
        }
      } catch (err) {
        console.error('[useChatBlur] Unexpected error:', err);
      }
    };

    checkStrikes();
  }, [partnerId, callState]);

  // Latch blur if flagged during the session
  useEffect(() => {
    if (isNsfwFlagged && !sessionUnblurredRef.current) {
      setIsBlurred(true);
    }
  }, [isNsfwFlagged]);

  const handleUnblur = () => {
    setIsBlurred(false);
    sessionUnblurredRef.current = true;
    stickyBlurRef.current = false;
    setIsNsfwFlagged(false);
    setUserManuallyUnblurred(true);
  };

  return {
    isBlurred,
    handleUnblur,
    userManuallyUnblurred,
    setIsNsfwFlagged,
  };
}