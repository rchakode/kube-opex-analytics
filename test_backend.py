#!/usr/bin/env python
__author__ = "Rodrigue Chakode"
__copyright__ = "Copyright 2019 Rodrigue Chakode and contributors"
__credits__ = ["Rodrigue Chakode and contributors"]
__license__ = "Apache"
__version__ = "2.0"
__maintainer__ = "Rodrigue Chakode"
__email__ = "Rodrigue Chakode <rodrigue.chakode @ gmail dot com"
__status__ = "Production"

import backend

class TestDecodeK8sMetrics(object):
    def test_decode_cpu_capacity_nounit(self):
        assert round( backend.K8sUsage().decode_cpu_capacity('1'), 0 ) == 1
        assert round( backend.K8sUsage().decode_cpu_capacity('64'), 0 ) == 64

    def test_decode_cpu_capacity_milli(self):
        assert round( backend.K8sUsage().decode_cpu_capacity('1m'), 3 ) == 1e-3
        assert round( backend.K8sUsage().decode_cpu_capacity('875m'), 3 ) == 875e-3 

    def test_decode_cpu_capacity_nano(self):
        assert round( backend.K8sUsage().decode_cpu_capacity('1n'), 9 ) == 1e-9
        assert round( backend.K8sUsage().decode_cpu_capacity('875n'), 9 ) == 875e-9

    def test_decode_cpu_capacity_micro(self):
        assert round( backend.K8sUsage().decode_cpu_capacity('1u'), 6 ) == 1e-6
        assert round( backend.K8sUsage().decode_cpu_capacity('875u'), 6 ) == 875e-6 

    def test_decode_memory_capacity_nounit(self):
        assert round( backend.K8sUsage().decode_memory_capacity('256'), 0 ) == 256
        assert round( backend.K8sUsage().decode_memory_capacity('875'), 0 ) == 875

    def test_decode_memory_capacity_Ki(self):
        assert round( backend.K8sUsage().decode_memory_capacity('1Ki'), 3 ) == 1e3
        assert round( backend.K8sUsage().decode_memory_capacity('875Ki'), 3 ) == 875e3

    def test_decode_memory_capacity_Mi(self):
        assert round( backend.K8sUsage().decode_memory_capacity('1Mi'), 6 ) == 1e6
        assert round( backend.K8sUsage().decode_memory_capacity('875Mi'), 6 ) == 875e6 

    def test_decode_memory_capacity_Gi(self):
        assert round( backend.K8sUsage().decode_memory_capacity('1Gi'), 9 ) == 1e9
        assert round( backend.K8sUsage().decode_memory_capacity('875Gi'), 9 ) == 875e9                    