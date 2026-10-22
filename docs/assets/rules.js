/* Generado con: python -m trama rules-js. No editar a mano; las reglas viven en trama/rules. */
window.TRAMA_RULES = [
 {
  "id": "CORR-AD-001",
  "title": "Kerberoasting seguido de movimiento lateral por WinRM o SMB",
  "status": "production",
  "author": "Yoandy Ramírez Delgado",
  "severity": "CRITICAL",
  "confidence": 0.96,
  "description": "Correlaciona una solicitud de ticket TGS con cifrado RC4 (0x17) sobre una cuenta con SPN expuesta (BloodHound, Nessus) y un inicio de sesión de red posterior (4624 de tipo 3 o 5140) de esa cuenta desde la misma IP.",
  "correlation": {
   "type": "temporal_sequence",
   "window": "45m",
   "group_by": [
    "target_service_account"
   ],
   "stages": [
    {
     "stage_id": "stage_1_tgs_request",
     "source_type": "windows_evtx",
     "match": {
      "event.NativeEventID": 4769,
      "process_or_artifact.EffectiveTicketEncryption": "0x17"
     },
     "posture_condition": {
      "offensive_posture_context.known_exposures.finding_class": [
       "kerberoastable_spn"
      ]
     },
     "extract": {
      "attacker_ip": "source.ip",
      "target_service_account": "target.target_user_or_spn"
     }
    },
    {
     "stage_id": "stage_2_lateral_movement",
     "source_type": "windows_evtx",
     "match": {
      "event.action": [
       "network_logon",
       "network_share_access"
      ],
      "actor.user_name": "$stage_1_tgs_request.target_service_account"
     },
     "predicates": {
      "equals_ref": {
       "source.ip": "$stage_1_tgs_request.attacker_ip"
      }
     }
    }
   ]
  },
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
  "id": "CORR-LNX-002",
  "title": "Escalada de privilegios en Linux mediante un binario SUID o con capabilities",
  "status": "production",
  "author": "Yoandy Ramírez Delgado",
  "severity": "CRITICAL",
  "confidence": 0.94,
  "description": "Detecta la enumeración de permisos SUID o capabilities por un usuario sin privilegios (o la ejecución de LinPEAS) seguida de un paso a root mediante un binario que LinPEAS o getcap señalaron como explotable.",
  "correlation": {
   "type": "temporal_sequence",
   "window": "30m",
   "group_by": [
    "target.hostname",
    "actor.user_name"
   ],
   "stages": [
    {
     "stage_id": "stage_1_privesc_enum",
     "source_type": "linux_auditd",
     "match": {
      "event.category": "process_creation"
     },
     "predicates": {
      "field_contains_any": {
       "process_or_artifact.command_line": [
        "-perm -4000",
        "-perm -u=s",
        "getcap -r",
        "linpeas",
        "pspy"
       ]
      },
      "not_equals": {
       "actor.euid": "0"
      }
     },
     "extract": {
      "low_priv_user": "actor.user_name",
      "compromised_host": "target.hostname"
     }
    },
    {
     "stage_id": "stage_2_suid_or_cap_exploitation",
     "source_type": "linux_auditd",
     "match": {
      "event.action": [
       "setuid_root_transition",
       "privileged_execution"
      ],
      "actor.user_name": "$stage_1_privesc_enum.low_priv_user",
      "target.hostname": "$stage_1_privesc_enum.compromised_host"
     },
     "posture_condition": {
      "offensive_posture_context.known_exposures.finding_class": [
       "dangerous_capability",
       "suid_gtfobin"
      ]
     },
     "predicates": {
      "require_suid_or_capabilities": true
     }
    }
   ]
  },
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
  "id": "CORR-WEB-003",
  "title": "Inyección SQL en el inicio de sesión seguida de ejecución de comandos en el servidor web",
  "status": "production",
  "author": "Yoandy Ramírez Delgado",
  "severity": "HIGH",
  "confidence": 0.92,
  "description": "Correlaciona cargas de inyección SQL con respuesta 200 contra un activo con la debilidad confirmada (Nuclei, Burp, Nessus) y la ejecución posterior de comandos por el usuario del servidor web en el mismo host.",
  "correlation": {
   "type": "temporal_sequence",
   "window": "15m",
   "group_by": [
    "target.hostname"
   ],
   "stages": [
    {
     "stage_id": "stage_1_sqli_payload",
     "source_type": "web_access_log",
     "match": {
      "event.category": "web_request"
     },
     "posture_condition": {
      "offensive_posture_context.known_exposures.finding_class": [
       "sqli"
      ]
     },
     "predicates": {
      "field_contains_any": {
       "process_or_artifact.command_line": [
        "union select",
        "' or 1=1",
        "or 1=1--",
        "sqlmap",
        "sleep(",
        "benchmark(",
        "information_schema"
       ]
      },
      "field_in_list": {
       "event.http_status": [
        200
       ]
      }
     },
     "extract": {
      "web_host": "target.hostname",
      "attacker_ip": "source.ip"
     }
    },
    {
     "stage_id": "stage_2_web_shell_spawn",
     "source_type": "linux_auditd",
     "match": {
      "event.category": "process_creation",
      "target.hostname": "$stage_1_sqli_payload.web_host"
     },
     "predicates": {
      "field_in_list": {
       "actor.user_name": [
        "www-data",
        "apache",
        "nginx",
        "httpd",
        "tomcat",
        "wwwrun"
       ]
      },
      "field_contains_any": {
       "process_or_artifact.command_line": [
        " -c ",
        "whoami",
        "uname",
        "/bin/sh",
        "/bin/bash",
        "nc ",
        "curl ",
        "wget "
       ]
      }
     }
    }
   ]
  },
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
];
