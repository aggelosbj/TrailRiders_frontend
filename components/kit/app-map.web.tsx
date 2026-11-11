// Web map: Leaflet + OpenStreetMap inside an iframe (react-native-maps does not support web)
import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { Brand, Radius } from '@/constants/brand';
import { AppMapProps, GREECE } from './map-types';

const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#m{margin:0;height:100%;width:100%;background:#E5E7EB}
.pin{width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center}
.pin span{transform:rotate(45deg);color:#fff;font:700 11px system-ui}
.me{width:16px;height:16px;border-radius:50%;background:#1DA1FA;border:3px solid #fff;box-shadow:0 0 0 6px rgba(29,161,250,.25)}
.leaflet-popup-content{font:13px system-ui}
.dark-tiles{filter:invert(1) hue-rotate(180deg) brightness(.92) contrast(.88) saturate(.6)}</style></head><body><div id="m"></div><script>
var map=L.map('m',{zoomControl:false,attributionControl:true});L.control.zoom({position:'bottomright'}).addTo(map);var layers=L.layerGroup().addTo(map),me=null,tiles=null;
function setTiles(dark){if(tiles)map.removeLayer(tiles);tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap',className:dark?'dark-tiles':''}).addTo(map);if(dark)document.body.style.background='#1f2328';}
function esc(s){return String(s||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
window.addEventListener('message',function(e){var d=e.data;if(!d||d.type!=='tr-map')return;
 if(d.first){setTiles(d.dark);if(!d.interactive){map.dragging.disable();map.scrollWheelZoom.disable();map.doubleClickZoom.disable();map.touchZoom.disable();}}
 layers.clearLayers();var b=[];
 (d.lines||[]).forEach(function(l){var c=l.coordinates.map(function(p){return [p.latitude,p.longitude]});if(c.length){L.polyline(c,{color:l.color||'#1DA1FA',weight:l.width||4}).addTo(layers);b=b.concat(c);}});
 (d.markers||[]).forEach(function(m){var ic=L.divIcon({className:'',html:'<div class="pin" style="background:'+(m.color||'#1DA1FA')+'"><span>'+esc(m.label)+'</span></div>',iconSize:[26,26],iconAnchor:[13,26]});
  var mk=L.marker([m.coordinate.latitude,m.coordinate.longitude],{icon:ic}).addTo(layers);
  if(m.title){mk.bindPopup('<b>'+esc(m.title)+'</b>'+(m.subtitle?'<br>'+esc(m.subtitle):'')+'<br><a href="#" style="color:#1DA1FA;font-weight:700">Open</a>');
   mk.on('popupopen',function(ev){var a=ev.popup.getElement().querySelector('a');if(a)a.onclick=function(x){x.preventDefault();parent.postMessage({type:'tr-map-press',id:m.id},'*')}});}
  else mk.on('click',function(){parent.postMessage({type:'tr-map-press',id:m.id},'*')});
  b.push([m.coordinate.latitude,m.coordinate.longitude]);});
 if(d.follow){if(!me)me=L.marker([0,0],{icon:L.divIcon({className:'',html:'<div class="me"></div>',iconSize:[16,16],iconAnchor:[8,8]})}).addTo(map);
  me.setLatLng([d.follow.latitude,d.follow.longitude]);map.setView([d.follow.latitude,d.follow.longitude],Math.max(map.getZoom()||16,15));}
 else if(d.fit&&b.length>1)map.fitBounds(b,{padding:[30,30]});
 else if(d.first){var c=d.center||(b[0]?{latitude:b[0][0],longitude:b[0][1]}:null)||d.fallback;map.setView([c.latitude,c.longitude],d.center||b.length?d.zoom:6);}
});
parent.postMessage({type:'tr-map-ready'},'*');
</script></body></html>`;

export function AppMap({
  markers = [],
  lines = [],
  fit = true,
  center,
  zoom = 12,
  follow,
  dark,
  onMarkerPress,
  height = 220,
  style,
  interactive = true,
}: AppMapProps) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const ready = useRef(false);
  const first = useRef(true);
  const onPress = useRef(onMarkerPress);

  const payload = useMemo(
    () => ({ type: 'tr-map', markers, lines, fit, center, zoom, follow: follow ?? null, dark: !!dark, interactive, fallback: GREECE }),
    [markers, lines, fit, center, zoom, follow, dark, interactive]
  );
  const latest = useRef(payload);

  useEffect(() => {
    onPress.current = onMarkerPress;
  }, [onMarkerPress]);

  useEffect(() => {
    const send = () => {
      const win = frame.current?.contentWindow;
      if (!win || !ready.current) return;
      win.postMessage({ ...latest.current, first: first.current }, '*');
      first.current = false;
    };
    latest.current = payload;
    send();

    const onMsg = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === 'tr-map-ready') {
        ready.current = true;
        send();
      } else if (e.data?.type === 'tr-map-press') {
        onPress.current?.(e.data.id);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [payload]);

  return (
    <View style={[styles.wrap, { height }, style]}>
      {React.createElement('iframe', {
        ref: frame,
        srcDoc: html,
        title: 'map',
        style: { border: 0, width: '100%', height: '100%', display: 'block' },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: Brand.border },
});
