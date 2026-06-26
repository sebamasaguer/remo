import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { getEarnings } from '@/api/drivers';
import { COLORS } from '@/constants';

type Period = 'day' | 'week' | 'month';

export default function EarningsScreen() {
  const [period, setPeriod] = useState<Period>('day');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async (p: Period) => {
    setLoading(true);
    try {
      const res = await getEarnings(p);
      setData(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(period); }, [period]);

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'day', label: 'Hoy' },
    { key: 'week', label: 'Semana' },
    { key: 'month', label: 'Mes' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: COLORS.text }}>Ganancias</Text>
      </View>

      {/* Selector período */}
      <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 20, gap: 8 }}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.key}
            onPress={() => setPeriod(p.key)}
            style={{
              flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
              backgroundColor: period === p.key ? COLORS.primary : COLORS.white,
              borderWidth: 1.5,
              borderColor: period === p.key ? COLORS.primary : COLORS.border,
            }}
          >
            <Text style={{ fontWeight: '700', color: period === p.key ? '#fff' : COLORS.textLight }}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <View style={{ marginHorizontal: 16 }}>
          {/* Total */}
          <View style={{
            backgroundColor: COLORS.primary, borderRadius: 20, padding: 28,
            alignItems: 'center', marginBottom: 16,
          }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 4 }}>
              Ganancias netas
            </Text>
            <Text style={{ color: '#fff', fontSize: 40, fontWeight: '800' }}>
              ${(data?.totalEarnings ?? 0).toFixed(2)}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>
              {data?.totalTrips ?? 0} viaje{data?.totalTrips !== 1 ? 's' : ''}
            </Text>
          </View>

          {/* Promedio por viaje */}
          {data?.totalTrips > 0 && (
            <View style={{
              backgroundColor: COLORS.white, borderRadius: 12, padding: 16,
              borderWidth: 1, borderColor: COLORS.border, alignItems: 'center',
            }}>
              <Text style={{ color: COLORS.textLight, fontSize: 13 }}>Promedio por viaje</Text>
              <Text style={{ fontSize: 24, fontWeight: '700', color: COLORS.text, marginTop: 4 }}>
                ${(data.totalEarnings / data.totalTrips).toFixed(2)}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
