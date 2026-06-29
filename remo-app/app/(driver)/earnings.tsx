import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { getEarnings } from '@/api/drivers';
import { COLORS } from '@/constants';

type Period = 'day' | 'week' | 'month';

interface EarningsData {
  period: string;
  totalTrips: number;
  totalEarnings: number;
  cashEarnings: number;
  digitalEarnings: number;
}

const PERIODS: { key: Period; label: string; description: string }[] = [
  { key: 'day',   label: 'Hoy',    description: 'últimas 24 h' },
  { key: 'week',  label: 'Semana', description: 'últimos 7 días' },
  { key: 'month', label: 'Mes',    description: 'últimos 30 días' },
];

export default function EarningsScreen() {
  const [period, setPeriod] = useState<Period>('day');
  const [data, setData] = useState<EarningsData | null>(null);
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

  const avgPerTrip = data && data.totalTrips > 0
    ? data.totalEarnings / data.totalTrips
    : 0;

  const cashPct = data && data.totalEarnings > 0
    ? (data.cashEarnings / data.totalEarnings) * 100
    : 50;

  const periodLabel = PERIODS.find((p) => p.key === period)?.description ?? '';

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.surface }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, backgroundColor: COLORS.white }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: COLORS.text }}>Ganancias</Text>
        <Text style={{ fontSize: 13, color: COLORS.muted, marginTop: 2 }}>
          {periodLabel}
        </Text>
      </View>

      {/* Selector período */}
      <View style={{
        flexDirection: 'row', marginHorizontal: 20, marginTop: 16, marginBottom: 20,
        backgroundColor: COLORS.surface, borderRadius: 14,
        borderWidth: 1, borderColor: COLORS.border, padding: 4,
        gap: 4,
      }}>
        {PERIODS.map((p) => {
          const active = period === p.key;
          return (
            <TouchableOpacity
              key={p.key}
              onPress={() => setPeriod(p.key)}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
                backgroundColor: active ? COLORS.primary : 'transparent',
              }}
            >
              <Text style={{
                fontWeight: '700', fontSize: 14,
                color: active ? '#fff' : COLORS.textLight,
              }}>
                {p.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero card */}
          <View style={{
            backgroundColor: COLORS.primary, borderRadius: 24,
            padding: 28, marginBottom: 16, alignItems: 'center',
          }}>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, letterSpacing: 0.5 }}>
              GANANCIAS NETAS
            </Text>
            <Text style={{ color: '#fff', fontSize: 48, fontWeight: '800', marginTop: 4 }}>
              ${(data?.totalEarnings ?? 0).toFixed(2)}
            </Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center', marginTop: 12,
              backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20,
              paddingHorizontal: 14, paddingVertical: 6,
            }}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                {data?.totalTrips ?? 0} viaje{(data?.totalTrips ?? 0) !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          {/* Stats grid */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
            <StatCard
              icon="💵"
              label="Efectivo"
              value={`$${(data?.cashEarnings ?? 0).toFixed(2)}`}
            />
            <StatCard
              icon="📱"
              label="Mercado Pago"
              value={`$${(data?.digitalEarnings ?? 0).toFixed(2)}`}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
            <StatCard
              icon="🚗"
              label="Viajes"
              value={String(data?.totalTrips ?? 0)}
            />
            <StatCard
              icon="📊"
              label="Promedio / viaje"
              value={avgPerTrip > 0 ? `$${avgPerTrip.toFixed(2)}` : '—'}
            />
          </View>

          {/* Breakdown de cobro */}
          {(data?.totalTrips ?? 0) > 0 && (
            <View style={{
              backgroundColor: COLORS.white, borderRadius: 18,
              padding: 20, borderWidth: 1, borderColor: COLORS.border,
            }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 16 }}>
                Composición de cobros
              </Text>

              {/* Barra */}
              <View style={{ height: 10, borderRadius: 5, backgroundColor: COLORS.surface, overflow: 'hidden', marginBottom: 14 }}>
                <View style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${cashPct}%`,
                  backgroundColor: COLORS.success,
                  borderRadius: 5,
                }} />
                <View style={{
                  position: 'absolute', right: 0, top: 0, bottom: 0,
                  width: `${100 - cashPct}%`,
                  backgroundColor: COLORS.primary,
                  borderRadius: 5,
                }} />
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.success, marginRight: 6 }} />
                  <Text style={{ fontSize: 13, color: COLORS.textLight }}>
                    Efectivo <Text style={{ fontWeight: '700', color: COLORS.text }}>{cashPct.toFixed(0)}%</Text>
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary, marginRight: 6 }} />
                  <Text style={{ fontSize: 13, color: COLORS.textLight }}>
                    MP <Text style={{ fontWeight: '700', color: COLORS.text }}>{(100 - cashPct).toFixed(0)}%</Text>
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Estado vacío */}
          {(data?.totalTrips ?? 0) === 0 && (
            <View style={{
              backgroundColor: COLORS.white, borderRadius: 18, padding: 32,
              alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
            }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>🚗</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 6 }}>
                Sin viajes {period === 'day' ? 'hoy' : period === 'week' ? 'esta semana' : 'este mes'}
              </Text>
              <Text style={{ fontSize: 13, color: COLORS.muted, textAlign: 'center' }}>
                Conectate y empezá a recibir solicitudes.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={{
      flex: 1, backgroundColor: COLORS.white, borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: COLORS.border,
    }}>
      <Text style={{ fontSize: 22, marginBottom: 8 }}>{icon}</Text>
      <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.text }}>{value}</Text>
      <Text style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>{label}</Text>
    </View>
  );
}
