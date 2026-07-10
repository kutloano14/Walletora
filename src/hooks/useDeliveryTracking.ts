import { useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface DeliveryStatusUpdate {
  orderId: string;
  status: 'picked_up' | 'arrived_at_restaurant' | 'arrived_at_customer' | 'delivered';
  driverLocation?: { lat: number; lng: number };
}

export const useDeliveryTracking = () => {
  const updateDeliveryStatus = useCallback(async (update: DeliveryStatusUpdate) => {
    try {
      // Update order status
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: update.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', update.orderId);

      if (orderError) {
        console.error('Error updating order status:', orderError);
        return false;
      }

      // Update delivery status
      const { error: deliveryError } = await supabase
        .from('deliveries')
        .update({
          status: update.status,
          ...(update.driverLocation && {
            driver_lat: update.driverLocation.lat,
            driver_lng: update.driverLocation.lng,
          }),
        })
        .eq('order_id', update.orderId);

      if (deliveryError) {
        console.error('Error updating delivery status:', deliveryError);
        return false;
      }

      // Status updated successfully
      
      // Trigger a page refresh to update the UI
      // This ensures the driver dashboard shows the updated status
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
      return true;
    } catch (error) {
      console.error('Unexpected error updating delivery status:', error);
      return false;
    }
  }, []);

  return { updateDeliveryStatus };
};