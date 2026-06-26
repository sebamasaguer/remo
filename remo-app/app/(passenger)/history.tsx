import { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { getMyTrips, Trip } from '@/api/trips';
import { COLORS } from '@/constants';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  completed: { label: 'Completado', color: COLORS.success },
  cancelled: { label: 'Cancelado', color: COLORS.danger },
  in_progress: { label: 'En curso', color: COLORS.primary },
};

export default function HistoryScreen() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = async (p = 1) => {
    try {
      const { data } = await getMyTrips(p);
      setTrips(p === 1 ? data.items : (prev) => [...prev, ...data.items]);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, []);

  const renderItem = ({ item }: { item: Trip }) => {
    const st = STATUS_LABELS[item.status] ?? { label: item.status, color: COLORS.muted };
    return (
      <View style={{
        backgroundColor: COLORS.white, borderRadius: 12, padding: 16,
        marginHorizontal: 16, marginBottom: 10,
        borderWidth: 1, borderColor: COLORS.border,
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontSize: 12, color: COLORS.muted }}>
            {new Date(item.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </Text>
          <View style={{ backgroundColor: st.color + '20', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: st.color }}>{st.label}</Text>
          </View>
        </View>

        <Text style={{ fontSize: 14, color: COLORS.textLight, marginBottom: 2 }}>
          📍 {item.originAddress}
        </Text>
        <Text style={{ fontSize: 14, color: COLORS.textLight, marginBottom: 12 }}>
          🏁 {item.destinationAddress}
        </Text>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 12, color: COLORS.muted }}>
            {item.paymentMethod === 'cash' ? '💵 Efectivo' : '📱 Mercado Pago'}
          </Text>
          {item.finalPrice || item.estimatedPrice ? (
            <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.text }}>
              ${(item.finalPrice ?? item.estimatedPrice).toFixed(2)}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.surface }}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: COLORS.text }}>Mis viajes</Text>
        <Text style={{ color: COLORS.textLight, fontSize: 13 }}>{total} viaje{total !== 1 ? 's' : ''} en total</Text>
      </View>

      <FlatList
        data={trips}
        keyExtractor={(t) => t.id}
        renderItem={renderItem}
        onEndReached={() => {
          if (trips.length < total) {
            const next = page + 1;
            setPage(next);
            load(next);
          }
        }}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🚕</Text>
            <Text style={{ color: COLORS.textLight, fontSize: 16 }}>Todavía no hiciste ningún viaje</Text>
          </View>
        }
      />
    </View>
  );
}
