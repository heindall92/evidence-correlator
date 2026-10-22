/* Generado por la CLI. No editar a mano. */
window.EVIDENCE_BUNDLE = {
 "generator": {
  "name": "TRAMA",
  "version": "0.2.4",
  "schema_version": "1.0.0"
 },
 "generated_at_utc": "2026-10-22T17:25:52Z",
 "forensic_custody_verification": {
  "valid": true,
  "total_sealed_events": 6,
  "genesis_hash": "49a9e3bd86bde19d6e5da00ffcd2f05e9dcb4f9aa14d551738cb8d6f7e9abeef",
  "head_seal_hash": "b2cefc540f6f4043aa06a6809dda06651d01481335110fe77795530b0f5dd230",
  "merkle_root_sha256": "20bd0099e79c5f0a0be296e9029dcef4080d2ca752fdb57058da683d0a4df129",
  "broken_at_index": null,
  "reason": null
 },
 "custody_chain": [
  {
   "index": 0,
   "source_type": "web_access_log",
   "source_file": "nginx_access_web_prod_01.log",
   "record_number": 9821,
   "raw_log_sha256": "dae557080bea81fe7556dccddf643cb0873c0bf6697674c6bff2bbf0490af2b4",
   "previous_node_hash": "49a9e3bd86bde19d6e5da00ffcd2f05e9dcb4f9aa14d551738cb8d6f7e9abeef",
   "chain_seal_sha256": "72dca29f96e5627751e59adba28a6fe417f616167c138398f97b2b4fac344954",
   "ingested_at_utc": "2026-10-22T17:25:52.258328Z"
  },
  {
   "index": 1,
   "source_type": "linux_auditd",
   "source_file": "/var/log/audit/audit.log",
   "record_number": 44102,
   "raw_log_sha256": "8116d84c889a3170500ddfda1eb94a332ff2d55dc36fb8845ff98610fe6fadb9",
   "previous_node_hash": "72dca29f96e5627751e59adba28a6fe417f616167c138398f97b2b4fac344954",
   "chain_seal_sha256": "e0d32527c1d19f97dc664ee5880d27e5f99f52bec60c258b4cafb11728c052b1",
   "ingested_at_utc": "2026-10-22T17:25:52.258470Z"
  },
  {
   "index": 2,
   "source_type": "linux_auditd",
   "source_file": "/var/log/audit/audit.log",
   "record_number": 44189,
   "raw_log_sha256": "874b4c400c0247aad98d7722822099a05989a0eff11e4f926adc9ac2bf901726",
   "previous_node_hash": "e0d32527c1d19f97dc664ee5880d27e5f99f52bec60c258b4cafb11728c052b1",
   "chain_seal_sha256": "f66b698a5864ca3dbd5f7bebde5f87dc2237e7f21f8c7bb2354346883392872b",
   "ingested_at_utc": "2026-10-22T17:25:52.258565Z"
  },
  {
   "index": 3,
   "source_type": "linux_auditd",
   "source_file": "/var/log/audit/audit.log",
   "record_number": 44210,
   "raw_log_sha256": "0651763d90ad160534311d8054aac92f98c3945e3c1f214ca3e48583e56d6e96",
   "previous_node_hash": "f66b698a5864ca3dbd5f7bebde5f87dc2237e7f21f8c7bb2354346883392872b",
   "chain_seal_sha256": "f7f6c1a56c32e41f04b350ec14d3f15409152ab5c0c005fc7fffebe90aaa27c3",
   "ingested_at_utc": "2026-10-22T17:25:52.258661Z"
  },
  {
   "index": 4,
   "source_type": "windows_evtx",
   "source_file": "Security_DC01_20261021.evtx",
   "record_number": 148920,
   "raw_log_sha256": "f1e0aa944a7dbd19a66888e370dc68fc6b5f3654c5bbebb9b48d699db60a00f1",
   "previous_node_hash": "f7f6c1a56c32e41f04b350ec14d3f15409152ab5c0c005fc7fffebe90aaa27c3",
   "chain_seal_sha256": "9bb8f1a25f5b89033bc894e157a734a9075f8ab6550b3f29a0aea08a7fee2de0",
   "ingested_at_utc": "2026-10-22T17:25:52.258810Z"
  },
  {
   "index": 5,
   "source_type": "windows_evtx",
   "source_file": "Security_DC01_20261021.evtx",
   "record_number": 149310,
   "raw_log_sha256": "1b246004c147687911127c97c593c163257cf2bfffb3920dc720a5a66d077b85",
   "previous_node_hash": "9bb8f1a25f5b89033bc894e157a734a9075f8ab6550b3f29a0aea08a7fee2de0",
   "chain_seal_sha256": "b2cefc540f6f4043aa06a6809dda06651d01481335110fe77795530b0f5dd230",
   "ingested_at_utc": "2026-10-22T17:25:52.258936Z"
  }
 ],
 "offensive_findings": [
  {
   "finding_id": "AD-SPN-RC4-001",
   "source_tool": "BloodHound CE",
   "hostname": "DC01.CORP.LOCAL",
   "target_spn": "svc_sql",
   "severity": "HIGH",
   "description": "Cuenta de servicio «svc_sql» con SPN activo (MSSQLSvc/db01.corp.local:1433) y cifrado RC4-HMAC (0x17) habilitado en Kerberos.",
   "finding_class": "kerberoastable_spn"
  },
  {
   "finding_id": "LNX-CAP-SETUID-002",
   "source_tool": "LinPEAS",
   "hostname": "WEB-PROD-01",
   "binary_path": "/usr/bin/python3",
   "severity": "CRITICAL",
   "description": "El binario /usr/bin/python3 tiene la capability «cap_setuid+ep», que permite cambiar el UID a 0 (root).",
   "finding_class": "dangerous_capability",
   "capabilities": [
    "cap_setuid"
   ]
  },
  {
   "finding_id": "WEB-SQLI-LOGIN-003",
   "source_tool": "Burp Suite Professional / SQLMap",
   "hostname": "WEB-PROD-01",
   "severity": "CRITICAL",
   "description": "El parámetro «username» de /api/v1/login es vulnerable a inyección SQL booleana y basada en UNION.",
   "finding_class": "sqli"
  }
 ],
 "rules": [
  {
   "id": "CORR-AD-001",
   "title": "Kerberoasting seguido de movimiento lateral por WinRM o SMB",
   "severity": "CRITICAL",
   "confidence": 0.96,
   "description": "Correlaciona una solicitud de ticket TGS con cifrado RC4 (0x17) sobre una cuenta con SPN expuesta (BloodHound, Nessus) y un inicio de sesión de red posterior (4624 de tipo 3 o 5140) de esa cuenta desde la misma IP.",
   "mitre_attack": [
    {
     "tactic": "Credential Access",
     "technique_id": "T1558.003",
     "technique_name": "Steal or Forge Kerberos Tickets: Kerberoasting"
    },
    {
     "tactic": "Lateral Movement",
     "technique_id": "T1021.006",
     "technique_name": "Remote Services: Windows Remote Management"
    }
   ],
   "posture_findings": [
    "kerberoastable_spn"
   ]
  },
  {
   "id": "CORR-LNX-002",
   "title": "Escalada de privilegios en Linux mediante un binario SUID o con capabilities",
   "severity": "CRITICAL",
   "confidence": 0.94,
   "description": "Detecta la enumeración de permisos SUID o capabilities por un usuario sin privilegios (o la ejecución de LinPEAS) seguida de un paso a root mediante un binario que LinPEAS o getcap señalaron como explotable.",
   "mitre_attack": [
    {
     "tactic": "Discovery",
     "technique_id": "T1083",
     "technique_name": "File and Directory Discovery"
    },
    {
     "tactic": "Privilege Escalation",
     "technique_id": "T1548.001",
     "technique_name": "Abuse Elevation Control Mechanism: Setuid and Setgid"
    }
   ],
   "posture_findings": [
    "dangerous_capability",
    "suid_gtfobin"
   ]
  },
  {
   "id": "CORR-WEB-003",
   "title": "Inyección SQL en el inicio de sesión seguida de ejecución de comandos en el servidor web",
   "severity": "HIGH",
   "confidence": 0.92,
   "description": "Correlaciona cargas de inyección SQL con respuesta 200 contra un activo con la debilidad confirmada (Nuclei, Burp, Nessus) y la ejecución posterior de comandos por el usuario del servidor web en el mismo host.",
   "mitre_attack": [
    {
     "tactic": "Initial Access",
     "technique_id": "T1190",
     "technique_name": "Exploit Public-Facing Application (SQL Injection)"
    },
    {
     "tactic": "Execution",
     "technique_id": "T1059.004",
     "technique_name": "Command and Scripting Interpreter: Unix Shell"
    }
   ],
   "posture_findings": [
    "sqli"
   ]
  }
 ],
 "normalized_events": [
  {
   "schema_version": "1.0.0",
   "event_id": "evt-web-1001",
   "timestamp_utc": "2026-10-21T08:15:10.120Z",
   "forensic_chain": {
    "index": 0,
    "source_type": "web_access_log",
    "source_file": "nginx_access_web_prod_01.log",
    "record_number": 9821,
    "raw_log_sha256": "dae557080bea81fe7556dccddf643cb0873c0bf6697674c6bff2bbf0490af2b4",
    "previous_node_hash": "49a9e3bd86bde19d6e5da00ffcd2f05e9dcb4f9aa14d551738cb8d6f7e9abeef",
    "chain_seal_sha256": "72dca29f96e5627751e59adba28a6fe417f616167c138398f97b2b4fac344954",
    "ingested_at_utc": "2026-10-22T17:25:52.258328Z"
   },
   "event": {
    "category": "web_request",
    "action": "http_post_login",
    "NativeEventID": null,
    "LogonType": null,
    "http_status": 200,
    "outcome": "success",
    "severity_base": 75
   },
   "actor": {
    "user_name": "unauthenticated_web",
    "user_sid": null,
    "uid": "",
    "euid": "",
    "domain": "EXTERNAL",
    "session_id": null,
    "privileges": []
   },
   "source": {
    "ip": "10.10.14.22",
    "port": 49122,
    "hostname": "KALI-PENTEST"
   },
   "target": {
    "hostname": "WEB-PROD-01",
    "ip": "10.10.10.80",
    "port": 443,
    "service_name": null,
    "target_user_or_spn": null,
    "resource_path": "/api/v1/login"
   },
   "process_or_artifact": {
    "process_name": "nginx",
    "parent_process_name": null,
    "command_line": "POST /api/v1/login username=admin' UNION SELECT 1,username,password FROM users-- (User-Agent: sqlmap/1.8)",
    "EffectiveTicketEncryption": null,
    "suid_bit": false,
    "capabilities": [],
    "file_sha256": null
   },
   "offensive_posture_context": {
    "asset_criticality": "HIGH",
    "known_exposures": [
     {
      "finding_id": "WEB-SQLI-LOGIN-003",
      "source_tool": "Burp Suite Professional / SQLMap",
      "hostname": "WEB-PROD-01",
      "severity": "CRITICAL",
      "description": "El parámetro «username» de /api/v1/login es vulnerable a inyección SQL booleana y basada en UNION.",
      "finding_class": "sqli"
     }
    ]
   },
   "graph_keys": {
    "actor_node": "USER:EXTERNAL\\unauthenticated_web",
    "source_node": "IP:10.10.14.22",
    "target_node": "HOST:WEB-PROD-01"
   }
  },
  {
   "schema_version": "1.0.0",
   "event_id": "evt-lnx-1002",
   "timestamp_utc": "2026-10-21T08:17:45.300Z",
   "forensic_chain": {
    "index": 1,
    "source_type": "linux_auditd",
    "source_file": "/var/log/audit/audit.log",
    "record_number": 44102,
    "raw_log_sha256": "8116d84c889a3170500ddfda1eb94a332ff2d55dc36fb8845ff98610fe6fadb9",
    "previous_node_hash": "72dca29f96e5627751e59adba28a6fe417f616167c138398f97b2b4fac344954",
    "chain_seal_sha256": "e0d32527c1d19f97dc664ee5880d27e5f99f52bec60c258b4cafb11728c052b1",
    "ingested_at_utc": "2026-10-22T17:25:52.258470Z"
   },
   "event": {
    "category": "process_creation",
    "action": "execve_syscall",
    "NativeEventID": null,
    "LogonType": null,
    "http_status": null,
    "outcome": "success",
    "severity_base": 80
   },
   "actor": {
    "user_name": "www-data",
    "user_sid": null,
    "uid": "33",
    "euid": "33",
    "domain": "WEB-PROD-01",
    "session_id": null,
    "privileges": []
   },
   "source": {
    "ip": "10.10.14.22",
    "port": null,
    "hostname": "WEB-PROD-01"
   },
   "target": {
    "hostname": "WEB-PROD-01",
    "ip": "10.10.10.80",
    "port": null,
    "service_name": null,
    "target_user_or_spn": null,
    "resource_path": null
   },
   "process_or_artifact": {
    "process_name": "/bin/bash",
    "parent_process_name": null,
    "command_line": "/bin/bash -c id; whoami; uname -a",
    "EffectiveTicketEncryption": null,
    "suid_bit": false,
    "capabilities": [],
    "file_sha256": null
   },
   "offensive_posture_context": {
    "asset_criticality": "HIGH",
    "known_exposures": [
     {
      "finding_id": "WEB-SQLI-LOGIN-003",
      "source_tool": "Burp Suite Professional / SQLMap",
      "hostname": "WEB-PROD-01",
      "severity": "CRITICAL",
      "description": "El parámetro «username» de /api/v1/login es vulnerable a inyección SQL booleana y basada en UNION.",
      "finding_class": "sqli"
     }
    ]
   },
   "graph_keys": {
    "actor_node": "USER:WEB-PROD-01\\www-data",
    "source_node": "IP:10.10.14.22",
    "target_node": "HOST:WEB-PROD-01"
   }
  },
  {
   "schema_version": "1.0.0",
   "event_id": "evt-lnx-1003",
   "timestamp_utc": "2026-10-21T08:20:12.004Z",
   "forensic_chain": {
    "index": 2,
    "source_type": "linux_auditd",
    "source_file": "/var/log/audit/audit.log",
    "record_number": 44189,
    "raw_log_sha256": "874b4c400c0247aad98d7722822099a05989a0eff11e4f926adc9ac2bf901726",
    "previous_node_hash": "e0d32527c1d19f97dc664ee5880d27e5f99f52bec60c258b4cafb11728c052b1",
    "chain_seal_sha256": "f66b698a5864ca3dbd5f7bebde5f87dc2237e7f21f8c7bb2354346883392872b",
    "ingested_at_utc": "2026-10-22T17:25:52.258565Z"
   },
   "event": {
    "category": "process_creation",
    "action": "execve_syscall",
    "NativeEventID": null,
    "LogonType": null,
    "http_status": null,
    "outcome": "success",
    "severity_base": 65
   },
   "actor": {
    "user_name": "www-data",
    "user_sid": null,
    "uid": "33",
    "euid": "33",
    "domain": "WEB-PROD-01",
    "session_id": null,
    "privileges": []
   },
   "source": {
    "ip": "10.10.10.80",
    "port": null,
    "hostname": "WEB-PROD-01"
   },
   "target": {
    "hostname": "WEB-PROD-01",
    "ip": "10.10.10.80",
    "port": null,
    "service_name": null,
    "target_user_or_spn": null,
    "resource_path": null
   },
   "process_or_artifact": {
    "process_name": "/usr/sbin/getcap",
    "parent_process_name": null,
    "command_line": "find / -perm -4000 2>/dev/null && getcap -r / 2>/dev/null",
    "EffectiveTicketEncryption": null,
    "suid_bit": false,
    "capabilities": [],
    "file_sha256": null
   },
   "offensive_posture_context": {
    "asset_criticality": "HIGH",
    "known_exposures": [
     {
      "finding_id": "WEB-SQLI-LOGIN-003",
      "source_tool": "Burp Suite Professional / SQLMap",
      "hostname": "WEB-PROD-01",
      "severity": "CRITICAL",
      "description": "El parámetro «username» de /api/v1/login es vulnerable a inyección SQL booleana y basada en UNION.",
      "finding_class": "sqli"
     }
    ]
   },
   "graph_keys": {
    "actor_node": "USER:WEB-PROD-01\\www-data",
    "source_node": "IP:10.10.10.80",
    "target_node": "HOST:WEB-PROD-01"
   }
  },
  {
   "schema_version": "1.0.0",
   "event_id": "evt-lnx-1004",
   "timestamp_utc": "2026-10-21T08:21:55.890Z",
   "forensic_chain": {
    "index": 3,
    "source_type": "linux_auditd",
    "source_file": "/var/log/audit/audit.log",
    "record_number": 44210,
    "raw_log_sha256": "0651763d90ad160534311d8054aac92f98c3945e3c1f214ca3e48583e56d6e96",
    "previous_node_hash": "f66b698a5864ca3dbd5f7bebde5f87dc2237e7f21f8c7bb2354346883392872b",
    "chain_seal_sha256": "f7f6c1a56c32e41f04b350ec14d3f15409152ab5c0c005fc7fffebe90aaa27c3",
    "ingested_at_utc": "2026-10-22T17:25:52.258661Z"
   },
   "event": {
    "category": "privilege_escalation",
    "action": "setuid_root_transition",
    "NativeEventID": null,
    "LogonType": null,
    "http_status": null,
    "outcome": "success",
    "severity_base": 95
   },
   "actor": {
    "user_name": "www-data",
    "user_sid": null,
    "uid": "33",
    "euid": "0",
    "domain": "WEB-PROD-01",
    "session_id": null,
    "privileges": [
     "root"
    ]
   },
   "source": {
    "ip": "10.10.10.80",
    "port": null,
    "hostname": "WEB-PROD-01"
   },
   "target": {
    "hostname": "WEB-PROD-01",
    "ip": "10.10.10.80",
    "port": null,
    "service_name": null,
    "target_user_or_spn": null,
    "resource_path": null
   },
   "process_or_artifact": {
    "process_name": "/usr/bin/python3",
    "parent_process_name": null,
    "command_line": "/usr/bin/python3 -c import os; os.setuid(0); os.system('/bin/bash')",
    "EffectiveTicketEncryption": null,
    "suid_bit": false,
    "capabilities": [
     "cap_setuid"
    ],
    "file_sha256": null
   },
   "offensive_posture_context": {
    "asset_criticality": "HIGH",
    "known_exposures": [
     {
      "finding_id": "LNX-CAP-SETUID-002",
      "source_tool": "LinPEAS",
      "hostname": "WEB-PROD-01",
      "binary_path": "/usr/bin/python3",
      "severity": "CRITICAL",
      "description": "El binario /usr/bin/python3 tiene la capability «cap_setuid+ep», que permite cambiar el UID a 0 (root).",
      "finding_class": "dangerous_capability",
      "capabilities": [
       "cap_setuid"
      ]
     },
     {
      "finding_id": "WEB-SQLI-LOGIN-003",
      "source_tool": "Burp Suite Professional / SQLMap",
      "hostname": "WEB-PROD-01",
      "severity": "CRITICAL",
      "description": "El parámetro «username» de /api/v1/login es vulnerable a inyección SQL booleana y basada en UNION.",
      "finding_class": "sqli"
     }
    ]
   },
   "graph_keys": {
    "actor_node": "USER:WEB-PROD-01\\www-data",
    "source_node": "IP:10.10.10.80",
    "target_node": "HOST:WEB-PROD-01"
   }
  },
  {
   "schema_version": "1.0.0",
   "event_id": "evt-ad-1005",
   "timestamp_utc": "2026-10-21T08:42:11.412Z",
   "forensic_chain": {
    "index": 4,
    "source_type": "windows_evtx",
    "source_file": "Security_DC01_20261021.evtx",
    "record_number": 148920,
    "raw_log_sha256": "f1e0aa944a7dbd19a66888e370dc68fc6b5f3654c5bbebb9b48d699db60a00f1",
    "previous_node_hash": "f7f6c1a56c32e41f04b350ec14d3f15409152ab5c0c005fc7fffebe90aaa27c3",
    "chain_seal_sha256": "9bb8f1a25f5b89033bc894e157a734a9075f8ab6550b3f29a0aea08a7fee2de0",
    "ingested_at_utc": "2026-10-22T17:25:52.258810Z"
   },
   "event": {
    "category": "authentication",
    "action": "kerberos_tgs_request",
    "NativeEventID": 4769,
    "LogonType": null,
    "http_status": null,
    "outcome": "success",
    "severity_base": 70
   },
   "actor": {
    "user_name": "j.garcia",
    "user_sid": "S-1-5-21-384920192-192837465-918273645-1104",
    "uid": "",
    "euid": "",
    "domain": "CORP.LOCAL",
    "session_id": "0x24a8f1",
    "privileges": [
     "Domain Users"
    ]
   },
   "source": {
    "ip": "10.10.14.22",
    "port": 54312,
    "hostname": "WKSTN-FIN-04"
   },
   "target": {
    "hostname": "DC01.CORP.LOCAL",
    "ip": "10.10.10.5",
    "port": 88,
    "service_name": "MSSQLSvc/db01.corp.local:1433",
    "target_user_or_spn": "svc_sql",
    "resource_path": null
   },
   "process_or_artifact": {
    "process_name": null,
    "parent_process_name": null,
    "command_line": null,
    "EffectiveTicketEncryption": "0x17",
    "suid_bit": false,
    "capabilities": [],
    "file_sha256": null
   },
   "offensive_posture_context": {
    "asset_criticality": "HIGH",
    "known_exposures": [
     {
      "finding_id": "AD-SPN-RC4-001",
      "source_tool": "BloodHound CE",
      "hostname": "DC01.CORP.LOCAL",
      "target_spn": "svc_sql",
      "severity": "HIGH",
      "description": "Cuenta de servicio «svc_sql» con SPN activo (MSSQLSvc/db01.corp.local:1433) y cifrado RC4-HMAC (0x17) habilitado en Kerberos.",
      "finding_class": "kerberoastable_spn"
     }
    ]
   },
   "graph_keys": {
    "actor_node": "USER:CORP.LOCAL\\j.garcia",
    "source_node": "IP:10.10.14.22",
    "target_node": "SPN:svc_sql"
   }
  },
  {
   "schema_version": "1.0.0",
   "event_id": "evt-ad-1006",
   "timestamp_utc": "2026-10-21T08:54:03.771Z",
   "forensic_chain": {
    "index": 5,
    "source_type": "windows_evtx",
    "source_file": "Security_DC01_20261021.evtx",
    "record_number": 149310,
    "raw_log_sha256": "1b246004c147687911127c97c593c163257cf2bfffb3920dc720a5a66d077b85",
    "previous_node_hash": "9bb8f1a25f5b89033bc894e157a734a9075f8ab6550b3f29a0aea08a7fee2de0",
    "chain_seal_sha256": "b2cefc540f6f4043aa06a6809dda06651d01481335110fe77795530b0f5dd230",
    "ingested_at_utc": "2026-10-22T17:25:52.258936Z"
   },
   "event": {
    "category": "lateral_movement",
    "action": "network_logon",
    "NativeEventID": 4624,
    "LogonType": 3,
    "http_status": null,
    "outcome": "success",
    "severity_base": 95
   },
   "actor": {
    "user_name": "svc_sql",
    "user_sid": "S-1-5-21-384920192-192837465-918273645-2109",
    "uid": "",
    "euid": "",
    "domain": "CORP.LOCAL",
    "session_id": "0x99b1c4",
    "privileges": [
     "SeBackupPrivilege",
     "Remote Management Users"
    ]
   },
   "source": {
    "ip": "10.10.14.22",
    "port": 55190,
    "hostname": "WKSTN-FIN-04"
   },
   "target": {
    "hostname": "DC01.CORP.LOCAL",
    "ip": "10.10.10.5",
    "port": 5985,
    "service_name": "HTTP/DC01.CORP.LOCAL (WinRM)",
    "target_user_or_spn": "svc_sql",
    "resource_path": "\\\\DC01.CORP.LOCAL\\C$"
   },
   "process_or_artifact": {
    "process_name": "wsmprovhost.exe",
    "parent_process_name": null,
    "command_line": "evil-winrm -i 10.10.10.5 -u svc_sql -p [REDACTED]",
    "EffectiveTicketEncryption": null,
    "suid_bit": false,
    "capabilities": [],
    "file_sha256": null
   },
   "offensive_posture_context": {
    "asset_criticality": "HIGH",
    "known_exposures": [
     {
      "finding_id": "AD-SPN-RC4-001",
      "source_tool": "BloodHound CE",
      "hostname": "DC01.CORP.LOCAL",
      "target_spn": "svc_sql",
      "severity": "HIGH",
      "description": "Cuenta de servicio «svc_sql» con SPN activo (MSSQLSvc/db01.corp.local:1433) y cifrado RC4-HMAC (0x17) habilitado en Kerberos.",
      "finding_class": "kerberoastable_spn"
     }
    ]
   },
   "graph_keys": {
    "actor_node": "USER:CORP.LOCAL\\svc_sql",
    "source_node": "IP:10.10.14.22",
    "target_node": "SPN:svc_sql"
   }
  }
 ],
 "correlation_results": {
  "total_events_analyzed": 6,
  "total_incidents_correlated": 3,
  "incidents": [
   {
    "incident_id": "INC-CORR-AD-001-01",
    "rule_id": "CORR-AD-001",
    "title": "Kerberoasting seguido de movimiento lateral por WinRM o SMB",
    "description": "Correlaciona una solicitud de ticket TGS con cifrado RC4 (0x17) sobre una cuenta con SPN expuesta (BloodHound, Nessus) y un inicio de sesión de red posterior (4624 de tipo 3 o 5140) de esa cuenta desde la misma IP.",
    "severity": "CRITICAL",
    "confidence": 0.96,
    "detected_at_utc": "2026-10-21T08:54:03.771Z",
    "attack_duration_seconds": 712,
    "correlation_vars": {
     "stage_1_tgs_request.attacker_ip": "10.10.14.22",
     "attacker_ip": "10.10.14.22",
     "stage_1_tgs_request.target_service_account": "svc_sql",
     "target_service_account": "svc_sql"
    },
    "evidence_merkle_root_sha256": "cd13c918ea9e3cb1425a4e24220ea25fcb439cfac6656b163a1aa0356600e362",
    "correlated_events": [
     {
      "stage_id": "stage_1_tgs_request",
      "event_id": "evt-ad-1005",
      "timestamp_utc": "2026-10-21T08:42:11.412Z",
      "source_type": "windows_evtx",
      "action": "kerberos_tgs_request",
      "actor": "j.garcia",
      "source_ip": "10.10.14.22",
      "target_host": "DC01.CORP.LOCAL",
      "command_line": null,
      "raw_log_sha256": "f1e0aa944a7dbd19a66888e370dc68fc6b5f3654c5bbebb9b48d699db60a00f1",
      "chain_seal_sha256": "9bb8f1a25f5b89033bc894e157a734a9075f8ab6550b3f29a0aea08a7fee2de0",
      "offensive_exposures": [
       {
        "finding_id": "AD-SPN-RC4-001",
        "source_tool": "BloodHound CE",
        "hostname": "DC01.CORP.LOCAL",
        "target_spn": "svc_sql",
        "severity": "HIGH",
        "description": "Cuenta de servicio «svc_sql» con SPN activo (MSSQLSvc/db01.corp.local:1433) y cifrado RC4-HMAC (0x17) habilitado en Kerberos.",
        "finding_class": "kerberoastable_spn"
       }
      ]
     },
     {
      "stage_id": "stage_2_lateral_movement",
      "event_id": "evt-ad-1006",
      "timestamp_utc": "2026-10-21T08:54:03.771Z",
      "source_type": "windows_evtx",
      "action": "network_logon",
      "actor": "svc_sql",
      "source_ip": "10.10.14.22",
      "target_host": "DC01.CORP.LOCAL",
      "command_line": "evil-winrm -i 10.10.10.5 -u svc_sql -p [REDACTED]",
      "raw_log_sha256": "1b246004c147687911127c97c593c163257cf2bfffb3920dc720a5a66d077b85",
      "chain_seal_sha256": "b2cefc540f6f4043aa06a6809dda06651d01481335110fe77795530b0f5dd230",
      "offensive_exposures": [
       {
        "finding_id": "AD-SPN-RC4-001",
        "source_tool": "BloodHound CE",
        "hostname": "DC01.CORP.LOCAL",
        "target_spn": "svc_sql",
        "severity": "HIGH",
        "description": "Cuenta de servicio «svc_sql» con SPN activo (MSSQLSvc/db01.corp.local:1433) y cifrado RC4-HMAC (0x17) habilitado en Kerberos.",
        "finding_class": "kerberoastable_spn"
       }
      ]
     }
    ],
    "mitre_attack": [
     {
      "tactic": "Credential Access",
      "technique_id": "T1558.003",
      "technique_name": "Steal or Forge Kerberos Tickets: Kerberoasting"
     },
     {
      "tactic": "Lateral Movement",
      "technique_id": "T1021.006",
      "technique_name": "Remote Services: Windows Remote Management"
     }
    ],
    "grc_compliance_mapping": {
     "ens_rd_311_2022": [
      {
       "control_id": "op.acc.5",
       "control_name": "Mecanismo de autenticación (cuentas de servicio)",
       "impact_level": "ALTO",
       "audit_verdict": "NO_CONFORME_CRITICO",
       "evidence_summary": "Uso de RC4-HMAC (0x17) en Kerberos para la cuenta de servicio, lo que expone su hash a extracción y descifrado fuera de línea."
      },
      {
       "control_id": "op.acc.6",
       "control_name": "Acceso local y remoto (WinRM y administración remota)",
       "impact_level": "ALTO",
       "audit_verdict": "NO_CONFORME",
       "evidence_summary": "La cuenta de servicio inicia sesión por red (LogonType 3) mediante WinRM (5985) y el recurso administrativo C$."
      }
     ],
     "iso_27001_2022": [
      {
       "control_id": "A.8.5",
       "control_name": "Autenticación segura",
       "audit_verdict": "NON_CONFORMITY_MAJOR"
      },
      {
       "control_id": "A.8.2",
       "control_name": "Derechos de acceso privilegiado",
       "audit_verdict": "NON_CONFORMITY_MAJOR"
      }
     ],
     "nis2_directive": [
      {
       "article": "Art. 21.2(i) & (j)",
       "topic": "Control de acceso, higiene de privilegios y autenticación segura"
      }
     ]
    }
   },
   {
    "incident_id": "INC-CORR-LNX-002-01",
    "rule_id": "CORR-LNX-002",
    "title": "Escalada de privilegios en Linux mediante un binario SUID o con capabilities",
    "description": "Detecta la enumeración de permisos SUID o capabilities por un usuario sin privilegios (o la ejecución de LinPEAS) seguida de un paso a root mediante un binario que LinPEAS o getcap señalaron como explotable.",
    "severity": "CRITICAL",
    "confidence": 0.94,
    "detected_at_utc": "2026-10-21T08:21:55.890Z",
    "attack_duration_seconds": 103,
    "correlation_vars": {
     "stage_1_privesc_enum.low_priv_user": "www-data",
     "low_priv_user": "www-data",
     "stage_1_privesc_enum.compromised_host": "WEB-PROD-01",
     "compromised_host": "WEB-PROD-01"
    },
    "evidence_merkle_root_sha256": "5dd4566c22ffc5407065121f11c0295d63bc827fd63654d571db7ccec2b68a2c",
    "correlated_events": [
     {
      "stage_id": "stage_1_privesc_enum",
      "event_id": "evt-lnx-1003",
      "timestamp_utc": "2026-10-21T08:20:12.004Z",
      "source_type": "linux_auditd",
      "action": "execve_syscall",
      "actor": "www-data",
      "source_ip": "10.10.10.80",
      "target_host": "WEB-PROD-01",
      "command_line": "find / -perm -4000 2>/dev/null && getcap -r / 2>/dev/null",
      "raw_log_sha256": "874b4c400c0247aad98d7722822099a05989a0eff11e4f926adc9ac2bf901726",
      "chain_seal_sha256": "f66b698a5864ca3dbd5f7bebde5f87dc2237e7f21f8c7bb2354346883392872b",
      "offensive_exposures": [
       {
        "finding_id": "WEB-SQLI-LOGIN-003",
        "source_tool": "Burp Suite Professional / SQLMap",
        "hostname": "WEB-PROD-01",
        "severity": "CRITICAL",
        "description": "El parámetro «username» de /api/v1/login es vulnerable a inyección SQL booleana y basada en UNION.",
        "finding_class": "sqli"
       }
      ]
     },
     {
      "stage_id": "stage_2_suid_or_cap_exploitation",
      "event_id": "evt-lnx-1004",
      "timestamp_utc": "2026-10-21T08:21:55.890Z",
      "source_type": "linux_auditd",
      "action": "setuid_root_transition",
      "actor": "www-data",
      "source_ip": "10.10.10.80",
      "target_host": "WEB-PROD-01",
      "command_line": "/usr/bin/python3 -c import os; os.setuid(0); os.system('/bin/bash')",
      "raw_log_sha256": "0651763d90ad160534311d8054aac92f98c3945e3c1f214ca3e48583e56d6e96",
      "chain_seal_sha256": "f7f6c1a56c32e41f04b350ec14d3f15409152ab5c0c005fc7fffebe90aaa27c3",
      "offensive_exposures": [
       {
        "finding_id": "LNX-CAP-SETUID-002",
        "source_tool": "LinPEAS",
        "hostname": "WEB-PROD-01",
        "binary_path": "/usr/bin/python3",
        "severity": "CRITICAL",
        "description": "El binario /usr/bin/python3 tiene la capability «cap_setuid+ep», que permite cambiar el UID a 0 (root).",
        "finding_class": "dangerous_capability",
        "capabilities": [
         "cap_setuid"
        ]
       },
       {
        "finding_id": "WEB-SQLI-LOGIN-003",
        "source_tool": "Burp Suite Professional / SQLMap",
        "hostname": "WEB-PROD-01",
        "severity": "CRITICAL",
        "description": "El parámetro «username» de /api/v1/login es vulnerable a inyección SQL booleana y basada en UNION.",
        "finding_class": "sqli"
       }
      ]
     }
    ],
    "mitre_attack": [
     {
      "tactic": "Discovery",
      "technique_id": "T1083",
      "technique_name": "File and Directory Discovery"
     },
     {
      "tactic": "Privilege Escalation",
      "technique_id": "T1548.001",
      "technique_name": "Abuse Elevation Control Mechanism: Setuid and Setgid"
     }
    ],
    "grc_compliance_mapping": {
     "ens_rd_311_2022": [
      {
       "control_id": "op.exp.2",
       "control_name": "Configuración de seguridad (bastionado del sistema Linux)",
       "impact_level": "ALTO",
       "audit_verdict": "NO_CONFORME_CRITICO",
       "evidence_summary": "Explotación confirmada del binario /usr/bin/python3, incluido en GTFOBins, con la capability cap_setuid+ep, que permite la escalada directa a root (euid=0)."
      },
      {
       "control_id": "mp.sw.2",
       "control_name": "Aceptación y puesta en servicio (mínimo privilegio en binarios)",
       "impact_level": "MEDIO",
       "audit_verdict": "NO_CONFORME",
       "evidence_summary": "No se validaron las capabilities ni los bits SUID durante el despliegue del servidor de aplicaciones."
      }
     ],
     "iso_27001_2022": [
      {
       "control_id": "A.8.9",
       "control_name": "Gestión de la configuración",
       "audit_verdict": "NON_CONFORMITY_MAJOR"
      },
      {
       "control_id": "A.8.18",
       "control_name": "Uso de programas de utilidad privilegiados",
       "audit_verdict": "NON_CONFORMITY_MAJOR"
      }
     ],
     "nis2_directive": [
      {
       "article": "Art. 21.2(d) & (e)",
       "topic": "Seguridad en la adquisición, desarrollo y mantenimiento de sistemas y gestión de vulnerabilidades"
      }
     ]
    }
   },
   {
    "incident_id": "INC-CORR-WEB-003-01",
    "rule_id": "CORR-WEB-003",
    "title": "Inyección SQL en el inicio de sesión seguida de ejecución de comandos en el servidor web",
    "description": "Correlaciona cargas de inyección SQL con respuesta 200 contra un activo con la debilidad confirmada (Nuclei, Burp, Nessus) y la ejecución posterior de comandos por el usuario del servidor web en el mismo host.",
    "severity": "HIGH",
    "confidence": 0.92,
    "detected_at_utc": "2026-10-21T08:17:45.300Z",
    "attack_duration_seconds": 155,
    "correlation_vars": {
     "stage_1_sqli_payload.web_host": "WEB-PROD-01",
     "web_host": "WEB-PROD-01",
     "stage_1_sqli_payload.attacker_ip": "10.10.14.22",
     "attacker_ip": "10.10.14.22"
    },
    "evidence_merkle_root_sha256": "1d4eaf77f1a3e4281babc18ebcbb77e74c86a8e9387c307654dae800363263d1",
    "correlated_events": [
     {
      "stage_id": "stage_1_sqli_payload",
      "event_id": "evt-web-1001",
      "timestamp_utc": "2026-10-21T08:15:10.120Z",
      "source_type": "web_access_log",
      "action": "http_post_login",
      "actor": "unauthenticated_web",
      "source_ip": "10.10.14.22",
      "target_host": "WEB-PROD-01",
      "command_line": "POST /api/v1/login username=admin' UNION SELECT 1,username,password FROM users-- (User-Agent: sqlmap/1.8)",
      "raw_log_sha256": "dae557080bea81fe7556dccddf643cb0873c0bf6697674c6bff2bbf0490af2b4",
      "chain_seal_sha256": "72dca29f96e5627751e59adba28a6fe417f616167c138398f97b2b4fac344954",
      "offensive_exposures": [
       {
        "finding_id": "WEB-SQLI-LOGIN-003",
        "source_tool": "Burp Suite Professional / SQLMap",
        "hostname": "WEB-PROD-01",
        "severity": "CRITICAL",
        "description": "El parámetro «username» de /api/v1/login es vulnerable a inyección SQL booleana y basada en UNION.",
        "finding_class": "sqli"
       }
      ]
     },
     {
      "stage_id": "stage_2_web_shell_spawn",
      "event_id": "evt-lnx-1002",
      "timestamp_utc": "2026-10-21T08:17:45.300Z",
      "source_type": "linux_auditd",
      "action": "execve_syscall",
      "actor": "www-data",
      "source_ip": "10.10.14.22",
      "target_host": "WEB-PROD-01",
      "command_line": "/bin/bash -c id; whoami; uname -a",
      "raw_log_sha256": "8116d84c889a3170500ddfda1eb94a332ff2d55dc36fb8845ff98610fe6fadb9",
      "chain_seal_sha256": "e0d32527c1d19f97dc664ee5880d27e5f99f52bec60c258b4cafb11728c052b1",
      "offensive_exposures": [
       {
        "finding_id": "WEB-SQLI-LOGIN-003",
        "source_tool": "Burp Suite Professional / SQLMap",
        "hostname": "WEB-PROD-01",
        "severity": "CRITICAL",
        "description": "El parámetro «username» de /api/v1/login es vulnerable a inyección SQL booleana y basada en UNION.",
        "finding_class": "sqli"
       }
      ]
     }
    ],
    "mitre_attack": [
     {
      "tactic": "Initial Access",
      "technique_id": "T1190",
      "technique_name": "Exploit Public-Facing Application (SQL Injection)"
     },
     {
      "tactic": "Execution",
      "technique_id": "T1059.004",
      "technique_name": "Command and Scripting Interpreter: Unix Shell"
     }
    ],
    "grc_compliance_mapping": {
     "ens_rd_311_2022": [
      {
       "control_id": "mp.s.2",
       "control_name": "Protección de las aplicaciones web (prevención de inyección SQL)",
       "impact_level": "ALTO",
       "audit_verdict": "NO_CONFORME_CRITICO",
       "evidence_summary": "Las consultas SQL del endpoint de inicio de sesión no están parametrizadas, lo que permite eludir la autenticación y acceder al servidor."
      }
     ],
     "iso_27001_2022": [
      {
       "control_id": "A.8.26",
       "control_name": "Requisitos de seguridad de las aplicaciones",
       "audit_verdict": "NON_CONFORMITY_MAJOR"
      },
      {
       "control_id": "A.8.28",
       "control_name": "Codificación segura",
       "audit_verdict": "NON_CONFORMITY_MAJOR"
      }
     ],
     "nis2_directive": [
      {
       "article": "Art. 21.2(e)",
       "topic": "Gestión y divulgación de vulnerabilidades en aplicaciones expuestas"
      }
     ]
    }
   }
  ],
  "entity_graph": {
   "nodes": [
    {
     "id": "USER:EXTERNAL\\unauthenticated_web",
     "type": "USER",
     "events_count": 1,
     "has_offensive_exposure": false
    },
    {
     "id": "IP:10.10.14.22",
     "type": "IP",
     "events_count": 4,
     "has_offensive_exposure": false
    },
    {
     "id": "HOST:WEB-PROD-01",
     "type": "HOST",
     "events_count": 4,
     "has_offensive_exposure": true
    },
    {
     "id": "USER:WEB-PROD-01\\www-data",
     "type": "USER",
     "events_count": 3,
     "has_offensive_exposure": false
    },
    {
     "id": "IP:10.10.10.80",
     "type": "IP",
     "events_count": 2,
     "has_offensive_exposure": false
    },
    {
     "id": "USER:CORP.LOCAL\\j.garcia",
     "type": "USER",
     "events_count": 1,
     "has_offensive_exposure": false
    },
    {
     "id": "SPN:svc_sql",
     "type": "SPN",
     "events_count": 2,
     "has_offensive_exposure": true
    },
    {
     "id": "USER:CORP.LOCAL\\svc_sql",
     "type": "USER",
     "events_count": 1,
     "has_offensive_exposure": false
    }
   ],
   "edges": [
    {
     "event_id": "evt-web-1001",
     "timestamp_utc": "2026-10-21T08:15:10.120Z",
     "from": "IP:10.10.14.22",
     "actor": "USER:EXTERNAL\\unauthenticated_web",
     "to": "HOST:WEB-PROD-01",
     "action": "http_post_login"
    },
    {
     "event_id": "evt-lnx-1002",
     "timestamp_utc": "2026-10-21T08:17:45.300Z",
     "from": "IP:10.10.14.22",
     "actor": "USER:WEB-PROD-01\\www-data",
     "to": "HOST:WEB-PROD-01",
     "action": "execve_syscall"
    },
    {
     "event_id": "evt-lnx-1003",
     "timestamp_utc": "2026-10-21T08:20:12.004Z",
     "from": "IP:10.10.10.80",
     "actor": "USER:WEB-PROD-01\\www-data",
     "to": "HOST:WEB-PROD-01",
     "action": "execve_syscall"
    },
    {
     "event_id": "evt-lnx-1004",
     "timestamp_utc": "2026-10-21T08:21:55.890Z",
     "from": "IP:10.10.10.80",
     "actor": "USER:WEB-PROD-01\\www-data",
     "to": "HOST:WEB-PROD-01",
     "action": "setuid_root_transition"
    },
    {
     "event_id": "evt-ad-1005",
     "timestamp_utc": "2026-10-21T08:42:11.412Z",
     "from": "IP:10.10.14.22",
     "actor": "USER:CORP.LOCAL\\j.garcia",
     "to": "SPN:svc_sql",
     "action": "kerberos_tgs_request"
    },
    {
     "event_id": "evt-ad-1006",
     "timestamp_utc": "2026-10-21T08:54:03.771Z",
     "from": "IP:10.10.14.22",
     "actor": "USER:CORP.LOCAL\\svc_sql",
     "to": "SPN:svc_sql",
     "action": "network_logon"
    }
   ]
  }
 },
 "grc_summary": {
  "ens_rd_311_2022": [
   {
    "control_id": "op.acc.5",
    "control_name": "Mecanismo de autenticación (cuentas de servicio)",
    "impact_level": "ALTO",
    "audit_verdict": "NO_CONFORME_CRITICO",
    "evidence_summary": "Uso de RC4-HMAC (0x17) en Kerberos para la cuenta de servicio, lo que expone su hash a extracción y descifrado fuera de línea.",
    "incidents": [
     "INC-CORR-AD-001-01"
    ]
   },
   {
    "control_id": "op.acc.6",
    "control_name": "Acceso local y remoto (WinRM y administración remota)",
    "impact_level": "ALTO",
    "audit_verdict": "NO_CONFORME",
    "evidence_summary": "La cuenta de servicio inicia sesión por red (LogonType 3) mediante WinRM (5985) y el recurso administrativo C$.",
    "incidents": [
     "INC-CORR-AD-001-01"
    ]
   },
   {
    "control_id": "op.exp.2",
    "control_name": "Configuración de seguridad (bastionado del sistema Linux)",
    "impact_level": "ALTO",
    "audit_verdict": "NO_CONFORME_CRITICO",
    "evidence_summary": "Explotación confirmada del binario /usr/bin/python3, incluido en GTFOBins, con la capability cap_setuid+ep, que permite la escalada directa a root (euid=0).",
    "incidents": [
     "INC-CORR-LNX-002-01"
    ]
   },
   {
    "control_id": "mp.sw.2",
    "control_name": "Aceptación y puesta en servicio (mínimo privilegio en binarios)",
    "impact_level": "MEDIO",
    "audit_verdict": "NO_CONFORME",
    "evidence_summary": "No se validaron las capabilities ni los bits SUID durante el despliegue del servidor de aplicaciones.",
    "incidents": [
     "INC-CORR-LNX-002-01"
    ]
   },
   {
    "control_id": "mp.s.2",
    "control_name": "Protección de las aplicaciones web (prevención de inyección SQL)",
    "impact_level": "ALTO",
    "audit_verdict": "NO_CONFORME_CRITICO",
    "evidence_summary": "Las consultas SQL del endpoint de inicio de sesión no están parametrizadas, lo que permite eludir la autenticación y acceder al servidor.",
    "incidents": [
     "INC-CORR-WEB-003-01"
    ]
   }
  ],
  "iso_27001_2022": [
   {
    "control_id": "A.8.5",
    "control_name": "Autenticación segura",
    "audit_verdict": "NON_CONFORMITY_MAJOR",
    "incidents": [
     "INC-CORR-AD-001-01"
    ]
   },
   {
    "control_id": "A.8.2",
    "control_name": "Derechos de acceso privilegiado",
    "audit_verdict": "NON_CONFORMITY_MAJOR",
    "incidents": [
     "INC-CORR-AD-001-01"
    ]
   },
   {
    "control_id": "A.8.9",
    "control_name": "Gestión de la configuración",
    "audit_verdict": "NON_CONFORMITY_MAJOR",
    "incidents": [
     "INC-CORR-LNX-002-01"
    ]
   },
   {
    "control_id": "A.8.18",
    "control_name": "Uso de programas de utilidad privilegiados",
    "audit_verdict": "NON_CONFORMITY_MAJOR",
    "incidents": [
     "INC-CORR-LNX-002-01"
    ]
   },
   {
    "control_id": "A.8.26",
    "control_name": "Requisitos de seguridad de las aplicaciones",
    "audit_verdict": "NON_CONFORMITY_MAJOR",
    "incidents": [
     "INC-CORR-WEB-003-01"
    ]
   },
   {
    "control_id": "A.8.28",
    "control_name": "Codificación segura",
    "audit_verdict": "NON_CONFORMITY_MAJOR",
    "incidents": [
     "INC-CORR-WEB-003-01"
    ]
   }
  ],
  "nis2_directive": [
   {
    "article": "Art. 21.2(i) & (j)",
    "topic": "Control de acceso, higiene de privilegios y autenticación segura",
    "incidents": [
     "INC-CORR-AD-001-01"
    ]
   },
   {
    "article": "Art. 21.2(d) & (e)",
    "topic": "Seguridad en la adquisición, desarrollo y mantenimiento de sistemas y gestión de vulnerabilidades",
    "incidents": [
     "INC-CORR-LNX-002-01"
    ]
   },
   {
    "article": "Art. 21.2(e)",
    "topic": "Gestión y divulgación de vulnerabilidades en aplicaciones expuestas",
    "incidents": [
     "INC-CORR-WEB-003-01"
    ]
   }
  ]
 },
 "raw_events": [
  {
   "event_id": "evt-web-1001",
   "timestamp_utc": "2026-10-21T08:15:10.120Z",
   "source_type": "web_access_log",
   "source_file": "nginx_access_web_prod_01.log",
   "record_number": 9821,
   "event": {
    "category": "web_request",
    "action": "http_post_login",
    "http_status": 200,
    "outcome": "success",
    "severity_base": 75
   },
   "actor": {
    "user_name": "unauthenticated_web",
    "domain": "EXTERNAL"
   },
   "source": {
    "ip": "10.10.14.22",
    "port": 49122,
    "hostname": "KALI-PENTEST"
   },
   "target": {
    "hostname": "WEB-PROD-01",
    "ip": "10.10.10.80",
    "port": 443,
    "resource_path": "/api/v1/login"
   },
   "process_or_artifact": {
    "process_name": "nginx",
    "command_line": "POST /api/v1/login username=admin' UNION SELECT 1,username,password FROM users-- (User-Agent: sqlmap/1.8)"
   }
  },
  {
   "event_id": "evt-lnx-1002",
   "timestamp_utc": "2026-10-21T08:17:45.300Z",
   "source_type": "linux_auditd",
   "source_file": "/var/log/audit/audit.log",
   "record_number": 44102,
   "event": {
    "category": "process_creation",
    "action": "execve_syscall",
    "outcome": "success",
    "severity_base": 80
   },
   "actor": {
    "user_name": "www-data",
    "uid": "33",
    "euid": "33",
    "domain": "WEB-PROD-01"
   },
   "source": {
    "ip": "10.10.14.22",
    "hostname": "WEB-PROD-01"
   },
   "target": {
    "hostname": "WEB-PROD-01",
    "ip": "10.10.10.80"
   },
   "process_or_artifact": {
    "process_name": "/bin/bash",
    "command_line": "/bin/bash -c id; whoami; uname -a"
   }
  },
  {
   "event_id": "evt-lnx-1003",
   "timestamp_utc": "2026-10-21T08:20:12.004Z",
   "source_type": "linux_auditd",
   "source_file": "/var/log/audit/audit.log",
   "record_number": 44189,
   "event": {
    "category": "process_creation",
    "action": "execve_syscall",
    "outcome": "success",
    "severity_base": 65
   },
   "actor": {
    "user_name": "www-data",
    "uid": "33",
    "euid": "33",
    "domain": "WEB-PROD-01"
   },
   "source": {
    "ip": "10.10.10.80",
    "hostname": "WEB-PROD-01"
   },
   "target": {
    "hostname": "WEB-PROD-01",
    "ip": "10.10.10.80"
   },
   "process_or_artifact": {
    "process_name": "/usr/sbin/getcap",
    "command_line": "find / -perm -4000 2>/dev/null && getcap -r / 2>/dev/null"
   }
  },
  {
   "event_id": "evt-lnx-1004",
   "timestamp_utc": "2026-10-21T08:21:55.890Z",
   "source_type": "linux_auditd",
   "source_file": "/var/log/audit/audit.log",
   "record_number": 44210,
   "event": {
    "category": "privilege_escalation",
    "action": "setuid_root_transition",
    "outcome": "success",
    "severity_base": 95
   },
   "actor": {
    "user_name": "www-data",
    "uid": "33",
    "euid": "0",
    "domain": "WEB-PROD-01",
    "privileges": [
     "root"
    ]
   },
   "source": {
    "ip": "10.10.10.80",
    "hostname": "WEB-PROD-01"
   },
   "target": {
    "hostname": "WEB-PROD-01",
    "ip": "10.10.10.80"
   },
   "process_or_artifact": {
    "process_name": "/usr/bin/python3",
    "command_line": "/usr/bin/python3 -c import os; os.setuid(0); os.system('/bin/bash')",
    "suid_bit": false,
    "capabilities": [
     "cap_setuid"
    ]
   }
  },
  {
   "event_id": "evt-ad-1005",
   "timestamp_utc": "2026-10-21T08:42:11.412Z",
   "source_type": "windows_evtx",
   "source_file": "Security_DC01_20261021.evtx",
   "record_number": 148920,
   "event": {
    "category": "authentication",
    "action": "kerberos_tgs_request",
    "NativeEventID": 4769,
    "outcome": "success",
    "severity_base": 70
   },
   "actor": {
    "user_name": "j.garcia",
    "user_sid": "S-1-5-21-384920192-192837465-918273645-1104",
    "domain": "CORP.LOCAL",
    "session_id": "0x24a8f1",
    "privileges": [
     "Domain Users"
    ]
   },
   "source": {
    "ip": "10.10.14.22",
    "port": 54312,
    "hostname": "WKSTN-FIN-04"
   },
   "target": {
    "hostname": "DC01.CORP.LOCAL",
    "ip": "10.10.10.5",
    "port": 88,
    "service_name": "MSSQLSvc/db01.corp.local:1433",
    "target_user_or_spn": "svc_sql"
   },
   "process_or_artifact": {
    "EffectiveTicketEncryption": "0x17"
   }
  },
  {
   "event_id": "evt-ad-1006",
   "timestamp_utc": "2026-10-21T08:54:03.771Z",
   "source_type": "windows_evtx",
   "source_file": "Security_DC01_20261021.evtx",
   "record_number": 149310,
   "event": {
    "category": "lateral_movement",
    "action": "network_logon",
    "NativeEventID": 4624,
    "LogonType": 3,
    "outcome": "success",
    "severity_base": 95
   },
   "actor": {
    "user_name": "svc_sql",
    "user_sid": "S-1-5-21-384920192-192837465-918273645-2109",
    "domain": "CORP.LOCAL",
    "session_id": "0x99b1c4",
    "privileges": [
     "SeBackupPrivilege",
     "Remote Management Users"
    ]
   },
   "source": {
    "ip": "10.10.14.22",
    "port": 55190,
    "hostname": "WKSTN-FIN-04"
   },
   "target": {
    "hostname": "DC01.CORP.LOCAL",
    "ip": "10.10.10.5",
    "port": 5985,
    "service_name": "HTTP/DC01.CORP.LOCAL (WinRM)",
    "target_user_or_spn": "svc_sql",
    "resource_path": "\\\\DC01.CORP.LOCAL\\C$"
   },
   "process_or_artifact": {
    "process_name": "wsmprovhost.exe",
    "command_line": "evil-winrm -i 10.10.10.5 -u svc_sql -p [REDACTED]"
   }
  }
 ],
 "dataset": "demo"
};
